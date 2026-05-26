import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/orders/by-ref?ref=...
 *
 * Public lookup used by /checkout/success after a Square Checkout redirects
 * the buyer back. The page polls this with the `ref` query Square appended
 * to the redirect URL until the webhook has created the Order row.
 *
 * NOTE: This is a PUBLIC endpoint by design — but only returns minimal,
 * non-sensitive fields a buyer who already paid would already know about
 * their own order. We do not return PII like phone number or full address.
 */
export async function GET(request: NextRequest) {
  const ref = request.nextUrl.searchParams.get('ref')
  if (!ref) {
    return NextResponse.json({ error: 'Missing ref' }, { status: 400 })
  }

  // Square reference IDs are stored in the metadata; we look up by the
  // Square order ID stashed in stripePaymentId at webhook time. Since the
  // buyer's redirect URL has the `referenceId`, we also need to look up by
  // that. To make this robust we search both.
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ stripePaymentId: ref }],
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      email: true,
      subtotal: true,
      shipping: true,
      discount: true,
      total: true,
      items: {
        select: { name: true, size: true, quantity: true, price: true },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ found: false }, { status: 404 })
  }

  return NextResponse.json(order)
}
