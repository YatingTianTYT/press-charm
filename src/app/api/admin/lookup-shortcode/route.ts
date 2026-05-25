import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'
import { parseShortCodeInput } from '@/lib/shortcode'

/**
 * GET /api/admin/lookup-shortcode?q=s-042
 *
 * Resolves a user-typed shortCode (e.g. "42", "042", "s-42", "S-042") into
 * a productId + optional pre-selected size. Used by /admin/sell main page
 * to jump straight into the sell flow.
 *
 * Only returns ACTIVE (archived=false) products. Past sales of an archived
 * product are still browsable via /admin/today; we just don't want to
 * accidentally sell from an archived listing.
 *
 * Returns:
 *   200 { productId, name, size?, shortCode, stock: {...} }
 *   404 { error }
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q') ?? ''
  const parsed = parseShortCodeInput(q)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Could not parse. Try "42" or "s-42" or "xs-001".' },
      { status: 400 },
    )
  }

  const product = await prisma.product.findFirst({
    where: { shortCode: parsed.code, archived: false },
    select: {
      id: true,
      name: true,
      shortCode: true,
      stockXS: true,
      stockS: true,
      stockM: true,
      stockL: true,
    },
  })
  if (!product) {
    return NextResponse.json(
      { error: `No active product with code #${String(parsed.code).padStart(3, '0')}` },
      { status: 404 },
    )
  }

  return NextResponse.json({
    productId: product.id,
    name: product.name,
    shortCode: product.shortCode,
    size: parsed.size, // optional — UI uses this to skip the size picker
    stock: {
      XS: product.stockXS,
      S: product.stockS,
      M: product.stockM,
      L: product.stockL,
    },
  })
}
