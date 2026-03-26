import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tag = searchParams.get('tag')
    const sort = searchParams.get('sort')
    const featured = searchParams.get('featured')
    const statusFilter = searchParams.get('status')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    // Admin can request all products by omitting status param
    // Non-admin always sees only published
    const token = request.cookies.get('admin_session')?.value
    const isAdmin = token && verifySession(token)
    if (!isAdmin || statusFilter) {
      where.status = statusFilter || 'published'
    }

    if (tag) {
      where.tags = { contains: tag }
    }

    if (featured === 'true') {
      where.featured = true
    }

    let orderBy: Record<string, string> = { createdAt: 'desc' }
    if (sort === 'price-asc') {
      orderBy = { price: 'asc' }
    } else if (sort === 'price-desc') {
      orderBy = { price: 'desc' }
    } else if (sort === 'newest') {
      orderBy = { createdAt: 'desc' }
    }

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        images: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const product = await prisma.product.create({
      data: {
        name,
        description: description || '',
        price,
        compareAtPrice: compareAtPrice || null,
        category: category || '',
        tags: tags || '',
        featured: featured || false,
        stockXS: stockXS || 0,
        stockS: stockS || 0,
        stockM: stockM || 0,
        stockL: stockL || 0,
        status: status || 'published',
        features: features || '',
        careInstructions: careInstructions || '',
        images: images?.length
          ? {
              create: images.map((img: { url: string }, index: number) => ({
                url: img.url,
                position: index,
              })),
            }
          : undefined,
      },
      include: {
        images: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
