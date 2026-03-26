'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Discount {
  id: string
  code: string
  type: string
  value: number
  minOrder: number | null
  expiresAt: string | null
  usageCount: number
  active: boolean
  createdAt: string
}

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDiscounts = async () => {
    try {
      const res = await fetch('/api/admin/discounts')
      if (res.ok) {
        setDiscounts(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch discounts:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiscounts()
  }, [])

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Delete discount code "${code}"?`)) return

    try {
      const res = await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDiscounts((prev) => prev.filter((d) => d.id !== id))
      } else {
        alert('Failed to delete discount')
      }
    } catch {
      alert('Failed to delete discount')
    }
  }

  const formatValue = (d: Discount) => {
    if (d.type === 'percent') return `${d.value}%`
    return `$${(d.value / 100).toFixed(2)}`
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Discounts</h1>
        <Link
          href="/admin/discounts/new"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Add Discount
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading discounts...</div>
      ) : discounts.length === 0 ? (
        <div className="text-gray-400 text-center py-12">No discount codes yet.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Min Order</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Expiry</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Used</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => (
                  <tr key={discount.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">
                      {discount.code}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {discount.type === 'percent' ? '%' : '$'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatValue(discount)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {discount.minOrder ? `$${(discount.minOrder / 100).toFixed(2)}` : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(discount.expiresAt)}</td>
                    <td className="px-4 py-3 text-gray-700">{discount.usageCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          discount.active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {discount.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(discount.id, discount.code)}
                        className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
