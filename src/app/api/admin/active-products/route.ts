import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

/**
 * GET /api/admin/active-products
 *
 * Lightweight list for the /admin/sell main page. Returns only non-archived
 * products with at least one main image, sorted to put recently-sold items
 * first (rest by newest).
 *
 * Shape:
 *   { products: [{ id, shortCode, name, price, image, stock: {...}, lastSoldAt }] }
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { archived: false },
    select: {
      id: true,
      shortCode: true,
      name: true,
      price: true,
      tags: true,
      createdAt: true,
      stockXS: true,
      stockS: true,
      stockM: true,
      stockL: true,
      images: {
        orderBy: { position: 'asc' },
        take: 1,
        select: { url: true },
      },
      sales: {
        orderBy: { soldAt: 'desc' },
        take: 1,
        select: { soldAt: true },
      },
    },
    orderBy: [{ shortCode: 'asc' }],
  })

  // Pull anything sold in the last 24h into a "recent" bucket for the UI to
  // pin at the top — these are the hot sellers the operator wants thumb-easy.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const shaped = products.map((p) => {
    const lastSoldAt = p.sales[0]?.soldAt ?? null
    return {
      id: p.id,
      shortCode: p.shortCode,
      name: p.name,
      price: p.price,
      image: p.images[0]?.url ?? null,
      tags: p.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      stock: {
        XS: p.stockXS,
        S: p.stockS,
        M: p.stockM,
        L: p.stockL,
      },
      lastSoldAt,
      isHotRecent: lastSoldAt ? lastSoldAt > dayAgo : false,
      createdAt: p.createdAt,
    }
  })

  return NextResponse.json({ products: shaped })
}
