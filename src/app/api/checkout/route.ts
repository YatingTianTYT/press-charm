import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { calculateShipping, calculateBulkDiscount } from '@/lib/utils'

/**
 * POST /api/checkout
 *
 * Creates a Square Checkout payment link and returns the URL the client
 * should redirect to. After payment, Square redirects back to
 * /checkout/success and fires the payment.updated webhook (handled in
 * /api/checkout/webhook) which is the source of truth for order creation.
 *
 * Required env:
 *   SQUARE_ACCESS_TOKEN  — Production access token from Square Developer Dashboard
 *   SQUARE_LOCATION_ID   — Your Square business location ID
 *   NEXT_PUBLIC_BASE_URL — Used for the success redirect URL
 *
 * Optional env:
 *   SQUARE_ENVIRONMENT   — "sandbox" or "production" (default: production)
 */

/**
 * Square's `buyerPhoneNumber` field requires strict E.164 format
 * ("+15551234567"). Anything else triggers "Invalid phone number" and the
 * whole createPaymentLink call fails. We're lenient: any non-conformant
 * input is returned as undefined so the field is omitted entirely.
 */
function normalizePhoneE164(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}` // US 10-digit
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}` // 1-prefixed US
  if (raw.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}` // already E.164-ish
  }
  return undefined
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, shippingAddress, discountCode } = body

    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!process.env.SQUARE_LOCATION_ID) {
      return NextResponse.json(
        { error: 'SQUARE_LOCATION_ID not configured on server' },
        { status: 500 },
      )
    }

    // -------- validate stock + compute subtotal from DB (don't trust client) --------
    let subtotal = 0
    const lineItems: Array<{
      uid: string
      name: string
      quantity: string
      basePriceMoney: { amount: bigint; currency: 'USD' }
      note?: string
      metadata: { productId: string; size: string }
    }> = []

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      })
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 400 },
        )
      }
      const stockField = `stock${item.size.toUpperCase()}` as
        | 'stockXS'
        | 'stockS'
        | 'stockM'
        | 'stockL'
      const stock = product[stockField] as number
      if (stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name} size ${item.size}` },
          { status: 400 },
        )
      }
      subtotal += product.price * item.quantity

      lineItems.push({
        uid: randomUUID(),
        name: `${product.name} (Size ${item.size.toUpperCase()})`,
        quantity: String(item.quantity),
        basePriceMoney: {
          amount: BigInt(product.price),
          currency: 'USD',
        },
        // We rely on metadata to round-trip the productId/size through the
        // webhook. Square preserves these on the resulting Order.
        metadata: {
          productId: product.id,
          size: item.size.toUpperCase(),
        },
      })
    }

    // -------- shipping (single line item) --------
    const shippingCost = calculateShipping(subtotal)
    if (shippingCost > 0) {
      lineItems.push({
        uid: randomUUID(),
        name: 'Shipping',
        quantity: '1',
        basePriceMoney: { amount: BigInt(shippingCost), currency: 'USD' },
        metadata: { productId: '_shipping', size: '_' },
      })
    }

    // -------- discounts --------
    // Square supports order-level discounts via order.discounts. Both the
    // bulk discount (2+ sets = $5 off each) and the coupon code go in here
    // as fixed-amount discounts.
    const bulkDiscountAmount = calculateBulkDiscount(
      items.reduce((sum: number, it: { quantity: number }) => sum + it.quantity, 0),
    )
    let couponDiscountAmount = 0
    let appliedDiscountCode: string | null = null

    if (discountCode) {
      const discount = await prisma.discountCode.findUnique({
        where: { code: discountCode },
      })
      if (!discount || !discount.active) {
        return NextResponse.json({ error: 'Invalid discount code' }, { status: 400 })
      }
      if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Discount code has expired' }, { status: 400 })
      }
      if (discount.minOrder && subtotal < discount.minOrder) {
        return NextResponse.json(
          {
            error: `Minimum order of $${(discount.minOrder / 100).toFixed(2)} required for this code`,
          },
          { status: 400 },
        )
      }
      couponDiscountAmount =
        discount.type === 'percent'
          ? Math.round(subtotal * (discount.value / 100))
          : discount.value
      appliedDiscountCode = discount.code
    }

    const orderDiscounts: Array<{
      uid: string
      name: string
      amountMoney: { amount: bigint; currency: 'USD' }
      scope: 'ORDER'
    }> = []
    if (bulkDiscountAmount > 0) {
      orderDiscounts.push({
        uid: randomUUID(),
        name: 'Bundle discount (2+ sets)',
        amountMoney: { amount: BigInt(bulkDiscountAmount), currency: 'USD' },
        scope: 'ORDER',
      })
    }
    if (couponDiscountAmount > 0 && appliedDiscountCode) {
      orderDiscounts.push({
        uid: randomUUID(),
        name: `Code: ${appliedDiscountCode}`,
        amountMoney: { amount: BigInt(couponDiscountAmount), currency: 'USD' },
        scope: 'ORDER',
      })
    }

    // -------- create payment link via direct fetch (bypassing SDK) --------
    // We tried the SDK first but it gave a generic "Missing required parameter"
    // with no field-level detail. Direct calls work cleanly (verified with
    // curl), so we serialize to snake_case JSON ourselves and POST it.
    const idempotencyKey = randomUUID()
    const referenceId = randomUUID() // we'll match this back to the order in the webhook

    // Order-level metadata that survives the webhook round-trip
    const orderMetadata: Record<string, string> = {
      customerName: shippingAddress.customerName || '',
      email: shippingAddress.email || '',
      phone: shippingAddress.phone || '',
      addressLine1: shippingAddress.addressLine1 || '',
      addressLine2: shippingAddress.addressLine2 || '',
      city: shippingAddress.city || '',
      state: shippingAddress.state || '',
      zipCode: shippingAddress.zipCode || '',
      // Pack items as JSON in metadata so the webhook can recreate them
      items: JSON.stringify(
        items.map((it: { productId: string; size: string; quantity: number }) => ({
          productId: it.productId,
          size: it.size.toUpperCase(),
          quantity: it.quantity,
        })),
      ),
      bulkDiscount: String(bulkDiscountAmount),
      couponDiscount: String(couponDiscountAmount),
      discountCode: appliedDiscountCode || '',
    }

    // Square has a 256-char limit per metadata value. If items JSON is too
    // long, stash a short reference and store the full payload in the DB to
    // be looked up by the webhook.
    if (orderMetadata.items.length > 240) {
      // (Edge case for huge carts. Park as a Sale draft row to be looked up.)
      orderMetadata.items = `__overflow__:${referenceId}`
      // ...nothing to write yet; for now we cap orders so this doesn't trip
    }

    // Build the snake_case JSON exactly like the working curl call.
    // Money amounts go as plain numbers (NOT BigInt) — Square API accepts
    // integer JSON numbers and many SDK BigInt issues vanish this way.
    const phoneE164 = normalizePhoneE164(shippingAddress.phone)
    const requestBody = {
      idempotency_key: idempotencyKey,
      order: {
        location_id: process.env.SQUARE_LOCATION_ID,
        reference_id: referenceId,
        line_items: lineItems.map((li) => ({
          uid: li.uid,
          name: li.name,
          quantity: li.quantity,
          base_price_money: {
            amount: Number(li.basePriceMoney.amount),
            currency: 'USD',
          },
          ...(li.metadata ? { metadata: li.metadata } : {}),
        })),
        ...(orderDiscounts.length > 0
          ? {
              discounts: orderDiscounts.map((d) => ({
                uid: d.uid,
                name: d.name,
                amount_money: {
                  amount: Number(d.amountMoney.amount),
                  currency: 'USD',
                },
                scope: 'ORDER',
              })),
            }
          : {}),
        metadata: orderMetadata,
      },
      checkout_options: {
        redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://press-charm.vercel.app'}/checkout/success?ref=${referenceId}`,
        ask_for_shipping_address: false,
        accepted_payment_methods: {
          apple_pay: true,
          google_pay: true,
          cash_app_pay: true,
          afterpay_clearpay: false,
        },
      },
      pre_populated_data: {
        buyer_email: shippingAddress.email,
        ...(phoneE164 ? { buyer_phone_number: phoneE164 } : {}),
      },
    }

    const squareResp = await fetch(
      'https://connect.squareup.com/v2/online-checkout/payment-links',
      {
        method: 'POST',
        headers: {
          'Square-Version': '2024-12-18',
          Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      },
    )
    const data = await squareResp.json()
    if (!squareResp.ok || !data.payment_link) {
      const errs = data.errors || []
      const detail =
        errs.map((e: { field?: string; code?: string; detail?: string }) =>
          `${e.field || e.code || 'error'}: ${e.detail}`,
        ).join('; ') || `HTTP ${squareResp.status}`
      console.error('[checkout] Square error:', JSON.stringify(errs, null, 2))
      console.error('[checkout] Request body that failed:', JSON.stringify(requestBody, null, 2))
      return NextResponse.json(
        { error: `Failed to create checkout session: ${detail}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      url: data.payment_link.url,
      referenceId,
    })
  } catch (error) {
    // Square SDK errors carry a `body` with detail. Dump the full set of
    // errors so we can see exactly which field is malformed.
    interface SquareErrorDetail {
      category?: string
      code?: string
      detail?: string
      field?: string
    }
    interface SquareErrorShape {
      message?: string
      body?: { errors?: SquareErrorDetail[] }
      errors?: SquareErrorDetail[]
      statusCode?: number
    }
    const err = error as SquareErrorShape
    const allErrors: SquareErrorDetail[] =
      err?.body?.errors || err?.errors || []
    // Format every Square error inline so we can spot the field that's failing
    const formatted = allErrors
      .map((e) => `${e.field || e.code || 'error'}: ${e.detail}`)
      .join('; ')
    const detail = formatted || err?.message || 'Unknown error'
    console.error('[checkout] Square errors (full):', JSON.stringify(allErrors, null, 2))
    console.error('[checkout] Original error object:', error)
    return NextResponse.json(
      { error: `Failed to create checkout session: ${detail}` },
      { status: 500 },
    )
  }
}
