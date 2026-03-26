import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, subtotal } = body

    if (!code) {
      return NextResponse.json({ error: 'Discount code is required' }, { status: 400 })
    }

    const discount = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (!discount || !discount.active) {
      return NextResponse.json({ valid: false, error: 'Invalid discount code' }, { status: 400 })
    }

    if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Discount code has expired' }, { status: 400 })
    }

    if (discount.minOrder && subtotal < discount.minOrder) {
      return NextResponse.json(
        {
          valid: false,
          error: `Minimum order of $${(discount.minOrder / 100).toFixed(2)} required`,
        },
        { status: 400 }
      )
    }

    let discountAmount = 0
    if (discount.type === 'percent') {
      discountAmount = Math.round((subtotal || 0) * (discount.value / 100))
    } else {
      discountAmount = discount.value
    }

    return NextResponse.json({
      valid: true,
      type: discount.type,
      value: discount.value,
      discountAmount,
    })
  } catch (error) {
    console.error('Error validating discount:', error)
    return NextResponse.json({ error: 'Failed to validate discount code' }, { status: 500 })
  }
}
