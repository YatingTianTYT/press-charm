import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

/**
 * GET /api/admin/sales?day=YYYY-MM-DD&channel=market|online|all
 *
 * Defaults: day=today (server local), channel=all.
 * Returns the list of Sale rows plus aggregated totals by payment method.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dayParam = request.nextUrl.searchParams.get('day')
  const channelParam = request.nextUrl.searchParams.get('channel') ?? 'all'

  const day = dayParam ? new Date(`${dayParam}T00:00:00`) : new Date()
  if (isNaN(day.getTime())) {
    return NextResponse.json({ error: 'Invalid day' }, { status: 400 })
  }
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const where: {
    soldAt: { gte: Date; lt: Date }
    channel?: string
  } = {
    soldAt: { gte: start, lt: end },
  }
  if (channelParam !== 'all') {
    where.channel = channelParam
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { soldAt: 'desc' },
  })

  // ---- aggregate ----
  const totals = {
    count: sales.length,
    revenueCents: sales.reduce((sum, s) => sum + s.price, 0),
    byPayment: { cash: 0, venmo: 0, card: 0, online: 0 } as Record<string, number>,
  }
  for (const s of sales) {
    totals.byPayment[s.paymentMethod] = (totals.byPayment[s.paymentMethod] ?? 0) + s.price
  }

  // ---- top sellers ----
  const productMap = new Map<string, { name: string; count: number; revenueCents: number }>()
  for (const s of sales) {
    const existing = productMap.get(s.productId)
    if (existing) {
      existing.count += 1
      existing.revenueCents += s.price
    } else {
      productMap.set(s.productId, { name: s.productName, count: 1, revenueCents: s.price })
    }
  }
  const topProducts = Array.from(productMap.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    day: start.toISOString().slice(0, 10),
    channel: channelParam,
    totals,
    topProducts,
    sales,
  })
}
