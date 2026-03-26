'use client'

import { useState, useEffect } from 'react'

interface Stats {
  totalProducts: number
  totalOrders: number
  pendingOrders: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalOrders: 0, pendingOrders: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [productsRes, ordersRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/orders'),
        ])

        const products = productsRes.ok ? await productsRes.json() : []
        const orders = ordersRes.ok ? await ordersRes.json() : []

        setStats({
          totalProducts: products.length,
          totalOrders: orders.length,
          pendingOrders: orders.filter((o: { status: string }) => o.status === 'pending').length,
        })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const cards = [
    { label: 'Total Products', value: stats.totalProducts, color: 'bg-blue-50 text-blue-700' },
    { label: 'Total Orders', value: stats.totalOrders, color: 'bg-green-50 text-green-700' },
    { label: 'Pending Orders', value: stats.pendingOrders, color: 'bg-yellow-50 text-yellow-700' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>

      {loading ? (
        <div className="text-gray-400">Loading stats...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <p className="text-sm text-gray-500 mb-1">{card.label}</p>
              <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
