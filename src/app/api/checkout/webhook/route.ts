import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { SquareClient, SquareEnvironment } from 'square'
import { prisma } from '@/lib/prisma'
import { calculateShipping, generateOrderNumber } from '@/lib/utils'

/**
 * POST /api/checkout/webhook
 *
 * Square webhook receiver. This is the source of truth for online orders —
 * we don't trust the success page (the customer might close the tab before
 * its client-side fetch finishes).
 *
 * Required env:
 *   SQUARE_ACCESS_TOKEN              — to fetch order details
 *   SQUARE_WEBHOOK_SIGNATURE_KEY     — to verify the request signature
 *   SQUARE_WEBHOOK_NOTIFICATION_URL  — exact URL Stripe was configured with
 *                                      (e.g. https://press-charm.vercel.app/api/checkout/webhook)
 *
 * Configure in Square Developer Dashboard → Your App → Webhooks:
 *   URL: https://press-charm.vercel.app/api/checkout/webhook
 *   Subscribe to: payment.updated  (fires when status becomes COMPLETED)
 *
 * Idempotent: if the same order.id has already been processed, returns 200
 * without re-creating.
 */

export const runtime = 'nodejs'

function squareClient(): SquareClient {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN || '',
    environment:
      process.env.SQUARE_ENVIRONMENT === 'sandbox'
        ? SquareEnvironment.Sandbox
        : SquareEnvironment.Production,
  })
}

/**
 * Verify the Square webhook signature.
 * Reference: https://developer.squareup.com/docs/webhooks/step3validate
 *
 * The signature is HMAC-SHA256 of (notificationUrl + rawBody) using
 * the signature key, base64-encoded.
 */
function verifySquareSignature(
  rawBody: string,
  signatureHeader: string,
  signatureKey: string,
  notificationUrl: string,
): boolean {
  const hmac = createHmac('sha256', signatureKey)
  hmac.update(notificationUrl + rawBody)
  const computed = hmac.digest('base64')
  // timing-safe compare requires equal length
  if (computed.length !== signatureHeader.length) return false
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  // ---- signature verification ----
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  const notificationUrl = process.env.SQUARE_WEBHOOK_NOTIFICATION_URL
  if (!signatureKey || !notificationUrl) {
    console.error('[webhook] SQUARE_WEBHOOK_SIGNATURE_KEY or NOTIFICATION_URL not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }
  const signature =
    request.headers.get('x-square-hmacsha256-signature') ||
    request.headers.get('x-square-signature') ||
    ''
  const rawBody = await request.text()
  if (!verifySquareSignature(rawBody, signature, signatureKey, notificationUrl)) {
    console.error('[webhook] signature mismatch')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ---- parse event ----
  let event: {
    type: string
    data: {
      type: string
      id: string
      object: {
        payment?: {
          id: string
          status: string
          orderId?: string
          referenceId?: string
        }
      }
    }
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle COMPLETED payments
  if (event.type !== 'payment.updated' && event.type !== 'payment.created') {
    console.log(`[webhook] ignoring event type=${event.type}`)
    return NextResponse.json({ received: true })
  }
  const payment = event.data.object.payment
  if (!payment || payment.status !== 'COMPLETED') {
    console.log(`[webhook] payment status=${payment?.status}, skipping`)
    return NextResponse.json({ received: true })
  }
  if (!payment.orderId) {
    console.log('[webhook] payment has no orderId, skipping')
    return NextResponse.json({ received: true })
  }

  // ---- fetch full order from Square to pull metadata + line items + referenceId ----
  let squareOrder
  try {
    const client = squareClient()
    const orderRes = await client.orders.get({ orderId: payment.orderId })
    squareOrder = orderRes.order
  } catch (err) {
    console.error('[webhook] failed to fetch Square order:', err)
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 })
  }
  if (!squareOrder) {
    return NextResponse.json({ error: 'Square order not found' }, { status: 404 })
  }
  const meta = squareOrder.metadata ?? {}

  // We use the referenceId (set during /api/checkout) as the canonical key
  // for idempotency AND for the success-page lookup. The buyer's redirect
  // URL has ?ref=<referenceId>.
  const refKey = squareOrder.referenceId || payment.referenceId || payment.orderId

  const existing = await prisma.order.findFirst({
    where: { stripePaymentId: refKey },
    select: { id: true, orderNumber: true },
  })
  if (existing) {
    console.log(
      `[webhook] order ${refKey} already processed as ${existing.orderNumber}`,
    )
    return NextResponse.json({ received: true, alreadyProcessed: true })
  }

  let items: { productId: string; size: string; quantity: number }[]
  try {
    items = JSON.parse(String(meta.items || '[]'))
  } catch {
    console.error('[webhook] could not parse metadata.items')
    return NextResponse.json({ error: 'Bad metadata.items' }, { status: 400 })
  }
  if (!items.length) {
    return NextResponse.json({ error: 'Empty items in metadata' }, { status: 400 })
  }

  // ---- atomic: create order + decrement stock + record sale + bump discount usage ----
  try {
    const order = await prisma.$transaction(async (tx) => {
      const orderItems: Array<{
        productId: string
        name: string
        size: string
        quantity: number
        price: number
      }> = []
      let subtotal = 0

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } })
        if (!product) throw new Error(`PRODUCT_NOT_FOUND: ${item.productId}`)
        const stockField = `stock${item.size.toUpperCase()}` as
          | 'stockXS'
          | 'stockS'
          | 'stockM'
          | 'stockL'
        const stock = product[stockField] as number
        if (stock < item.quantity) {
          throw new Error(
            `OUT_OF_STOCK: ${product.name} size ${item.size} (have ${stock}, want ${item.quantity})`,
          )
        }
        subtotal += product.price * item.quantity
        orderItems.push({
          productId: product.id,
          name: product.name,
          size: item.size.toUpperCase(),
          quantity: item.quantity,
          price: product.price,
        })
      }

      const shipping = calculateShipping(subtotal)
      const discount =
        (parseInt(String(meta.bulkDiscount || '0'), 10) || 0) +
        (parseInt(String(meta.couponDiscount || '0'), 10) || 0)
      const total = subtotal + shipping - discount

      const orderNumber = generateOrderNumber()

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerName: String(meta.customerName || ''),
          email: String(meta.email || ''),
          phone: String(meta.phone || ''),
          addressLine1: String(meta.addressLine1 || ''),
          addressLine2: String(meta.addressLine2 || ''),
          city: String(meta.city || ''),
          state: String(meta.state || ''),
          zipCode: String(meta.zipCode || ''),
          subtotal,
          shipping,
          discount,
          total,
          discountCode: meta.discountCode ? String(meta.discountCode) : null,
          // Reusing the existing column. Holds Square's referenceId for online
          // sales (NOT the payment.orderId — referenceId is what the buyer's
          // redirect URL carries, so it works for the by-ref lookup too).
          stripePaymentId: refKey,
          items: { create: orderItems },
        },
        include: { items: true },
      })

      // Decrement stock + maybe archive
      for (const item of items) {
        const stockField = `stock${item.size.toUpperCase()}` as
          | 'stockXS'
          | 'stockS'
          | 'stockM'
          | 'stockL'
        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { [stockField]: { decrement: item.quantity } },
          select: { stockXS: true, stockS: true, stockM: true, stockL: true },
        })
        const remaining =
          updated.stockXS + updated.stockS + updated.stockM + updated.stockL
        if (remaining === 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { archived: true },
          })
        }

        // Mirror into the Sale ledger so /admin/today shows online sales too
        await tx.sale.create({
          data: {
            productId: item.productId,
            productName:
              orderItems.find((oi) => oi.productId === item.productId)?.name || '',
            size: item.size.toUpperCase(),
            price:
              orderItems.find((oi) => oi.productId === item.productId)?.price ?? 0,
            paymentMethod: 'online',
            stripePaymentIntentId: payment.id,
            channel: 'online',
            orderId: created.id,
          },
        })
      }

      if (meta.discountCode) {
        await tx.discountCode.updateMany({
          where: { code: String(meta.discountCode) },
          data: { usageCount: { increment: 1 } },
        })
      }

      return created
    })

    console.log(
      `[webhook] ✓ created order ${order.orderNumber} for Square order ${payment.orderId}`,
    )

    // Best-effort confirmation email
    try {
      const { sendOrderConfirmation } = await import('@/lib/email')
      await sendOrderConfirmation(order)
    } catch (err) {
      console.error('[webhook] email failed (non-fatal):', err)
    }

    return NextResponse.json({ received: true, orderId: order.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[webhook] order creation failed:', msg)
    // Non-2xx → Square retries the webhook (good for transient DB issues)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
