import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

/**
 * POST /api/admin/sell
 *
 * Market Mode: record an in-person sale, decrement the matching size's stock
 * atomically, and write a Sale row. Payment is handled out-of-band for
 * cash / venmo; for card we expect a `stripePaymentIntentId` from a
 * successful Tap-to-Pay charge.
 *
 * Body: {
 *   productId: string
 *   size: 'XS' | 'S' | 'M' | 'L'
 *   paymentMethod: 'cash' | 'venmo' | 'card'
 *   stripePaymentIntentId?: string  // required when paymentMethod === 'card'
 *   note?: string
 * }
 */

const SIZE_TO_FIELD: Record<string, 'stockXS' | 'stockS' | 'stockM' | 'stockL'> = {
  XS: 'stockXS',
  S: 'stockS',
  M: 'stockM',
  L: 'stockL',
}

const VALID_PAYMENT_METHODS = ['cash', 'venmo', 'card'] as const
type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number]

export async function POST(request: NextRequest) {
  // ---- auth ----
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ---- parse + validate ----
  let body: {
    productId?: string
    size?: string
    paymentMethod?: string
    stripePaymentIntentId?: string
    note?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { productId, size, paymentMethod, stripePaymentIntentId, note } = body

  if (!productId || !size || !paymentMethod) {
    return NextResponse.json(
      { error: 'productId, size, and paymentMethod are required' },
      { status: 400 },
    )
  }
  const stockField = SIZE_TO_FIELD[size]
  if (!stockField) {
    return NextResponse.json({ error: `Invalid size: ${size}` }, { status: 400 })
  }
  if (!VALID_PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)) {
    return NextResponse.json(
      { error: `paymentMethod must be one of ${VALID_PAYMENT_METHODS.join(', ')}` },
      { status: 400 },
    )
  }
  if (paymentMethod === 'card' && !stripePaymentIntentId) {
    return NextResponse.json(
      { error: 'card sales require stripePaymentIntentId' },
      { status: 400 },
    )
  }

  // ---- atomic: decrement stock + write Sale row + maybe archive ----
  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } })
      if (!product) throw new Error('PRODUCT_NOT_FOUND')

      const currentStock = product[stockField]
      if (currentStock <= 0) throw new Error('OUT_OF_STOCK')

      // Compute the new per-size stock numbers so we can check "fully sold out"
      const newStock = {
        stockXS: product.stockXS,
        stockS: product.stockS,
        stockM: product.stockM,
        stockL: product.stockL,
      }
      newStock[stockField] = currentStock - 1

      // If every size is now 0 → archive the product so it drops off the
      // sell page automatically. shortCode stays so we can identify the
      // product in historical Sale records; the allocator just considers
      // archived codes free once the active pool hits 999.
      const totalRemaining =
        newStock.stockXS + newStock.stockS + newStock.stockM + newStock.stockL
      const shouldArchive = totalRemaining === 0

      await tx.product.update({
        where: { id: productId },
        data: {
          [stockField]: { decrement: 1 },
          ...(shouldArchive ? { archived: true } : {}),
        },
      })

      const sale = await tx.sale.create({
        data: {
          productId,
          productName: product.name,
          size,
          price: product.price,
          paymentMethod,
          stripePaymentIntentId: stripePaymentIntentId ?? null,
          channel: 'market',
          note: note ?? '',
        },
      })

      return {
        sale,
        remainingStock: currentStock - 1,
        archived: shouldArchive,
      }
    })

    return NextResponse.json({
      ok: true,
      archived: result.archived,
      saleId: result.sale.id,
      remainingStock: result.remainingStock,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'PRODUCT_NOT_FOUND') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    if (msg === 'OUT_OF_STOCK') {
      return NextResponse.json({ error: 'That size is already sold out' }, { status: 409 })
    }
    console.error('[POST /api/admin/sell] failed:', err)
    return NextResponse.json({ error: 'Failed to record sale' }, { status: 500 })
  }
}

/**
 * GET /api/admin/sell?productId=xxx
 *
 * Returns the product + remaining stock per size, for the Market Mode UI.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const productId = request.nextUrl.searchParams.get('productId')
  if (!productId) {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { images: { orderBy: { position: 'asc' } } },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: product.id,
    name: product.name,
    price: product.price,
    images: product.images.map((i) => i.url),
    stock: {
      XS: product.stockXS,
      S: product.stockS,
      M: product.stockM,
      L: product.stockL,
    },
  })
}
