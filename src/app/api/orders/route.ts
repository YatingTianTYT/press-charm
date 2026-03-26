import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { generateOrderNumber, calculateShipping } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  orderBy: { position: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customerName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zipCode,
      items,
      discountCode,
      discountAmount,
      stripePaymentId,
    } = body

    if (!customerName || !email || !addressLine1 || !city || !state || !zipCode || !items?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate stock and calculate subtotal
    let subtotal = 0
    const orderItems: { productId: string; name: string; size: string; quantity: number; price: number }[] = []

    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } })
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
      orderItems.push({
        productId: product.id,
        name: product.name,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
      })
    }

    const shipping = calculateShipping(subtotal)
    const discount = discountAmount || 0
    const total = subtotal + shipping - discount

    const orderNumber = generateOrderNumber()

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName,
        email,
        phone: phone || '',
        addressLine1,
        addressLine2: addressLine2 || '',
        city,
        state,
        zipCode,
        subtotal,
        shipping,
        discount,
        total,
        discountCode: discountCode || null,
        stripePaymentId: stripePaymentId || null,
        items: {
          create: orderItems,
        },
      },
      include: { items: true },
    })

    // Decrease stock
    for (const item of items) {
      const stockField = `stock${item.size.toUpperCase()}`
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          [stockField]: { decrement: item.quantity },
        },
      })
    }

    // Increment discount code usage if used
    if (discountCode) {
      await prisma.discountCode.updateMany({
        where: { code: discountCode },
        data: { usageCount: { increment: 1 } },
      })
    }

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
