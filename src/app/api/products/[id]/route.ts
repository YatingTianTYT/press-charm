import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: {
          orderBy: { position: 'asc' },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      name,
      description,
      price,
      compareAtPrice,
      category,
      tags,
      featured,
      stockXS,
      stockS,
      stockM,
      stockL,
      images,
      status,
      features,
      careInstructions,
    } = body

    // If images are provided, delete old ones and create new ones
    if (images) {
      await prisma.productImage.deleteMany({ where: { productId: id } })
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(compareAtPrice !== undefined && { compareAtPrice }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(featured !== undefined && { featured }),
        ...(stockXS !== undefined && { stockXS }),
        ...(stockS !== undefined && { stockS }),
        ...(stockM !== undefined && { stockM }),
        ...(stockL !== undefined && { stockL }),
        ...(status !== undefined && { status }),
        ...(features !== undefined && { features }),
        ...(careInstructions !== undefined && { careInstructions }),
        ...(images && {
          images: {
            create: images.map((img: { url: string }, index: number) => ({
              url: img.url,
              position: index,
            })),
          },
        }),
      },
      include: {
        images: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await prisma.product.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
