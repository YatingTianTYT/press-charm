import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const discounts = await prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(discounts)
  } catch (error) {
    console.error('Error fetching discounts:', error)
    return NextResponse.json({ error: 'Failed to fetch discounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, type, value, minOrder, expiresAt, active } = body

    if (!code || !type || value === undefined) {
      return NextResponse.json({ error: 'Code, type, and value are required' }, { status: 400 })
    }

    if (!['percent', 'fixed'].includes(type)) {
      return NextResponse.json({ error: 'Type must be "percent" or "fixed"' }, { status: 400 })
    }

    const discount = await prisma.discountCode.create({
      data: {
        code: code.toUpperCase(),
        type,
        value,
        minOrder: minOrder || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        active: active !== undefined ? active : true,
      },
    })

    return NextResponse.json(discount, { status: 201 })
  } catch (error) {
    console.error('Error creating discount:', error)
    return NextResponse.json({ error: 'Failed to create discount' }, { status: 500 })
  }
}
