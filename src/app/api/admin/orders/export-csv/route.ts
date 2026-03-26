import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/auth'

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('admin_session')?.value
    if (!token || !verifySession(token)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: { status: 'packed' },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    })

    const headers = [
      'Name', 'Company', 'Address1', 'Address2', 'City', 'State', 'Zip',
      'Country', 'Weight(oz)', 'Length', 'Width', 'Height', 'Service',
    ]

    const rows = orders.map((order) => [
      csvEscape(order.customerName),
      '', // Company
      csvEscape(order.addressLine1),
      csvEscape(order.addressLine2),
      csvEscape(order.city),
      csvEscape(order.state),
      csvEscape(order.zipCode),
      'US',
      '1', // Weight in oz
      '6', // Length
      '4', // Width
      '1', // Height
      '', // Service
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="pirateship-orders-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting CSV:', error)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
