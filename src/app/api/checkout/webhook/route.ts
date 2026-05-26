import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { calculateShipping, generateOrderNumber } from '@/lib/utils'

/**
 * POST /api/checkout/webhook
 *
 * Stripe webhook receiver. The only RELIABLE way to know a payment went
 * through — the success page can't be trusted because the customer might
 * close their browser before the page-side fetch finishes.
 *
 * Required env:
 *   STRIPE_SECRET_KEY        — to construct the Stripe client
 *   STRIPE_WEBHOOK_SECRET    — to verify the signature header
 *
 * Configure in Stripe Dashboard → Developers → Webhooks:
 *   URL: https://press-charm.vercel.app/api/checkout/webhook
 *   Listen to: checkout.session.completed
 *
 * The handler is idempotent: if the same session.id was already processed
 * (the order row already exists), we just return 200 and skip.
 */

// Webhook must NOT be parsed as JSON before signature verification — we
// need the raw bytes. Next 15+: opt out of body parsing.
export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
})

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }
  if (!webhookSecret || webhookSecret.startsWith('whsec_YOUR') || webhookSecret === '') {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Stripe requires the raw body to verify the signature
  const rawBody = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error(`[webhook] signature verification failed: ${msg}`)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only handle the one event we care about
  if (event.type !== 'checkout.session.completed') {
    console.log(`[webhook] ignoring event type=${event.type}`)
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // Guard: only process successful payments
  if (session.payment_status !== 'paid') {
    console.log(`[webhook] session ${session.id} not paid (${session.payment_status}), skipping`)
    return NextResponse.json({ received: true })
  }

  // ---- idempotency check ----
  const existing = await prisma.order.findFirst({
    where: { stripePaymentId: session.id },
    select: { id: true, orderNumber: true },
  })
  if (existing) {
    console.log(`[webhook] session ${session.id} already processed as order ${existing.orderNumber}`)
    return NextResponse.json({ received: true, alreadyProcessed: true, orderId: existing.id })
  }

  // ---- pull metadata that /api/checkout stored on the session ----
  const meta = session.metadata
  if (!meta) {
    console.error(`[webhook] session ${session.id} has no metadata — cannot build order`)
    return NextResponse.json({ error: 'Session missing metadata' }, { status: 400 })
  }

  let items: { productId: string; size: string; quantity: number }[]
  try {
    items = JSON.parse(meta.items || '[]')
  } catch {
    console.error(`[webhook] could not parse session metadata.items`)
    return NextResponse.json({ error: 'Bad metadata.items' }, { status: 400 })
  }
  if (!items.length) {
    return NextResponse.json({ error: 'Empty items in metadata' }, { status: 400 })
  }

  // ---- atomic: create order + decrement stock + record short-code archive + bump discount usage ----
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Recompute subtotal from current product prices (don't trust client)
      const orderItems: {
        productId: string
        name: string
        size: string
        quantity: number
        price: number
      }[] = []
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
      const discount = parseInt(meta.discountAmount || '0', 10) || 0
      const total = subtotal + shipping - discount

      const orderNumber = generateOrderNumber()

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerName: meta.customerName || session.customer_details?.name || '',
          email: meta.email || session.customer_details?.email || '',
          phone: meta.phone || session.customer_details?.phone || '',
          addressLine1: meta.addressLine1 || '',
          addressLine2: meta.addressLine2 || '',
          city: meta.city || '',
          state: meta.state || '',
          zipCode: meta.zipCode || '',
          subtotal,
          shipping,
          discount,
          total,
          discountCode: meta.discountCode || null,
          stripePaymentId: session.id,
          items: { create: orderItems },
        },
        include: { items: true },
      })

      // Decrement stock + archive any product that becomes fully sold out
      for (const item of items) {
        const stockField = `stock${item.size.toUpperCase()}` as
          | 'stockXS'
          | 'stockS'
          | 'stockM'
          | 'stockL'
        const updated = await tx.product.update({
          where: { id: item.productId },
          data: { [stockField]: { decrement: item.quantity } },
          select: {
            stockXS: true,
            stockS: true,
            stockM: true,
            stockL: true,
          },
        })
        const remaining =
          updated.stockXS + updated.stockS + updated.stockM + updated.stockL
        if (remaining === 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { archived: true },
          })
        }

        // Mirror the in-person Sale ledger so /admin/today and reports work
        await tx.sale.create({
          data: {
            productId: item.productId,
            productName: orderItems.find((oi) => oi.productId === item.productId)?.name || '',
            size: item.size.toUpperCase(),
            price:
              orderItems.find((oi) => oi.productId === item.productId)?.price ?? 0,
            paymentMethod: 'online',
            stripePaymentIntentId: session.payment_intent as string | null,
            channel: 'online',
            orderId: created.id,
          },
        })
      }

      // Bump discount code usage
      if (meta.discountCode) {
        await tx.discountCode.updateMany({
          where: { code: meta.discountCode },
          data: { usageCount: { increment: 1 } },
        })
      }

      return created
    })

    console.log(`[webhook] ✓ created order ${order.orderNumber} for session ${session.id}`)

    // Best-effort confirmation email — non-fatal if it fails (Stripe will
    // have already sent a payment receipt as a fallback)
    try {
      const { sendOrderConfirmation } = await import('@/lib/email')
      await sendOrderConfirmation(order)
    } catch (err) {
      console.error('[webhook] email send failed (non-fatal):', err)
    }

    return NextResponse.json({ received: true, orderId: order.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error(`[webhook] failed to create order for session ${session.id}: ${msg}`)
    // Returning non-2xx tells Stripe to retry — good for transient DB issues
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
