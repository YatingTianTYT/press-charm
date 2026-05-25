'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Channel = 'all' | 'market' | 'online'

interface Sale {
  id: string
  productId: string
  productName: string
  size: string
  price: number
  paymentMethod: string
  channel: string
  soldAt: string
}

interface TodayData {
  day: string
  channel: Channel
  totals: {
    count: number
    revenueCents: number
    byPayment: Record<string, number>
  }
  topProducts: { productId: string; name: string; count: number; revenueCents: number }[]
  sales: Sale[]
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

const PAYMENT_LABELS: Record<string, { label: string; emoji: string }> = {
  cash: { label: 'Cash', emoji: '💵' },
  venmo: { label: 'Venmo', emoji: '📱' },
  card: { label: 'Card', emoji: '💳' },
  online: { label: 'Online', emoji: '🌐' },
}

export default function TodayPage() {
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [channel, setChannel] = useState<Channel>('all')
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/sales?day=${day}&channel=${channel}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [day, channel])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Sales — {day}</h1>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg"
          />
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg"
          >
            <option value="all">All channels</option>
            <option value="market">Market only</option>
            <option value="online">Online only</option>
          </select>
          <button
            onClick={load}
            className="px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400">Loading…</p>}

      {!loading && data && (
        <>
          {/* ---- big numbers ---- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <p className="text-sm text-gray-500 mb-1">Total revenue</p>
              <p className="text-4xl font-bold text-gray-900">
                {formatPrice(data.totals.revenueCents)}
              </p>
              <p className="text-sm text-gray-500 mt-2">{data.totals.count} items sold</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <p className="text-sm text-gray-500 mb-3">By payment method</p>
              <div className="space-y-1.5">
                {Object.entries(data.totals.byPayment)
                  .filter(([, v]) => v > 0)
                  .map(([method, cents]) => {
                    const meta = PAYMENT_LABELS[method] ?? { label: method, emoji: '•' }
                    return (
                      <div key={method} className="flex justify-between text-gray-800">
                        <span>
                          <span className="mr-2">{meta.emoji}</span>
                          {meta.label}
                        </span>
                        <span className="font-medium">{formatPrice(cents)}</span>
                      </div>
                    )
                  })}
                {Object.values(data.totals.byPayment).every((v) => v === 0) && (
                  <p className="text-gray-400 text-sm">No sales yet today.</p>
                )}
              </div>
            </div>
          </div>

          {/* ---- top sellers ---- */}
          {data.topProducts.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Top sellers</h2>
              <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
                {data.topProducts.slice(0, 8).map((p) => (
                  <Link
                    key={p.productId}
                    href={`/admin/sell/${p.productId}`}
                    className="flex justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.count} sold</p>
                    </div>
                    <p className="text-gray-700">{formatPrice(p.revenueCents)}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ---- ledger ---- */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">All sales</h2>
            {data.sales.length === 0 ? (
              <p className="text-gray-400">No sales recorded for this day.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                      <th className="px-4 py-2 font-medium">Time</th>
                      <th className="px-4 py-2 font-medium">Product</th>
                      <th className="px-4 py-2 font-medium">Size</th>
                      <th className="px-4 py-2 font-medium">Pay</th>
                      <th className="px-4 py-2 font-medium text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.sales.map((s) => {
                      const meta = PAYMENT_LABELS[s.paymentMethod] ?? {
                        label: s.paymentMethod,
                        emoji: '•',
                      }
                      return (
                        <tr key={s.id} className="text-gray-800">
                          <td className="px-4 py-2 text-gray-500">
                            {new Date(s.soldAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-2">{s.productName}</td>
                          <td className="px-4 py-2">{s.size}</td>
                          <td className="px-4 py-2">
                            {meta.emoji} {meta.label}
                          </td>
                          <td className="px-4 py-2 text-right">{formatPrice(s.price)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
