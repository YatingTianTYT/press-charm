import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const product = await prisma.product.update({
      where: { id },
      data: { status: 'published' },
      include: {
        images: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error publishing product:', error)
    return NextResponse.json({ error: 'Failed to publish product' }, { status: 500 })
  }
}
