import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateShipping, calculateBulkDiscount } from '@/lib/utils'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, shippingAddress, discountCode } = body

    if (!items?.length || !shippingAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate products and stock
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    let subtotal = 0

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { images: { orderBy: { position: 'asc' }, take: 1 } },
      })

      if (!product) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 })
      }

      const stockField = `stock${item.size.toUpperCase()}` as keyof typeof product
      const stock = product[stockField] as number
      if (stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name} size ${item.size}` },
          { status: 400 }
        )
      }

      subtotal += product.price * item.quantity

      const images = product.images.length > 0
        ? [product.images[0].url.startsWith('http') ? product.images[0].url : `${process.env.NEXT_PUBLIC_BASE_URL}${product.images[0].url}`]
        : undefined

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${product.name} (Size ${item.size.toUpperCase()})`,
            ...(images && { images }),
          },
          unit_amount: product.price,
        },
        quantity: item.quantity,
      })
    }

    // Calculate bulk discount (2+ sets = $5 off each)
    const totalQuantity = items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0)
    const bulkDiscountAmount = calculateBulkDiscount(totalQuantity)

    // Calculate shipping (after bulk discount)
    const shippingCost = calculateShipping(subtotal - bulkDiscountAmount)
    if (shippingCost > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping',
          },
          unit_amount: shippingCost,
        },
        quantity: 1,
      })
    }

    // Validate and apply discount code
    let discountAmount = 0
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
          { error: `Minimum order of $${(discount.minOrder / 100).toFixed(2)} required for this code` },
          { status: 400 }
        )
      }

      if (discount.type === 'percent') {
        discountAmount = Math.round(subtotal * (discount.value / 100))
      } else {
        discountAmount = discount.value
      }

      appliedDiscountCode = discount.code

      // Add discount as a negative line item via coupon
      // Stripe doesn't support negative line items, so we use discounts
    }

    // Build Stripe session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
      metadata: {
        items: JSON.stringify(items),
        customerName: shippingAddress.customerName,
        email: shippingAddress.email,
        phone: shippingAddress.phone || '',
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.zipCode,
        discountCode: appliedDiscountCode || '',
        discountAmount: (discountAmount + bulkDiscountAmount).toString(),
        bulkDiscount: bulkDiscountAmount.toString(),
        subtotal: subtotal.toString(),
        shipping: shippingCost.toString(),
      },
      customer_email: shippingAddress.email,
    }

    // Apply combined discount (bulk + coupon) via Stripe coupon
    const totalDiscount = discountAmount + bulkDiscountAmount
    if (totalDiscount > 0) {
      const discountParts = []
      if (bulkDiscountAmount > 0) discountParts.push(`Bundle: -$${(bulkDiscountAmount / 100).toFixed(2)}`)
      if (appliedDiscountCode) discountParts.push(`Code: ${appliedDiscountCode}`)

      const coupon = await stripe.coupons.create({
        amount_off: totalDiscount,
        currency: 'usd',
        duration: 'once',
        name: discountParts.join(' + '),
      })

      sessionParams.discounts = [{ coupon: coupon.id }]
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
