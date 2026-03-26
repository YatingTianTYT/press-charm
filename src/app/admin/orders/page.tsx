'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OrderItem {
  id: string
  name: string
  size: string
  quantity: number
  price: number
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  status: string
  trackingNumber: string
  total: number
  createdAt: string
  items: OrderItem[]
}

const STATUS_TABS = ['All', 'New', 'Packed', 'Shipped', 'Done'] as const
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  packed: 'bg-yellow-100 text-yellow-700',
  shipped: 'bg-purple-100 text-purple-700',
  done: 'bg-green-100 text-green-700',
  pending: 'bg-blue-100 text-blue-700',
  fulfilled: 'bg-green-100 text-green-700',
}

function normalizeStatus(status: string): string {
  if (status === 'pending') return 'new'
  if (status === 'fulfilled') return 'done'
  return status
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('All')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTracking, setBulkTracking] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch('/api/orders')
        if (res.ok) {
          setOrders(await res.json())
        }
      } catch (err) {
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrders()
  }, [])

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'All') return true
    return normalizeStatus(o.status) === activeTab.toLowerCase()
  })

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        )
      }
    } catch {
      alert('Failed to update status')
    }
  }

  const copyAddress = async (order: Order) => {
    const parts = [
      order.customerName,
      order.addressLine1,
      order.addressLine2,
      `${order.city}, ${order.state} ${order.zipCode}`,
    ].filter(Boolean)
    await navigator.clipboard.writeText(parts.join('\n'))
    setCopiedId(order.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filteredOrders.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredOrders.map((o) => o.id)))
    }
  }

  const handleBulkShip = async () => {
    if (selected.size === 0) return
    for (const id of selected) {
      try {
        await fetch(`/api/admin/orders/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'shipped',
            ...(bulkTracking ? { trackingNumber: bulkTracking } : {}),
          }),
        })
      } catch {
        // continue with other orders
      }
    }
    // Refresh
    setOrders((prev) =>
      prev.map((o) =>
        selected.has(o.id)
          ? { ...o, status: 'shipped', ...(bulkTracking ? { trackingNumber: bulkTracking } : {}) }
          : o
      )
    )
    setSelected(new Set())
    setBulkTracking('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
        <a
          href="/api/admin/orders/export-csv"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Export for Pirateship
        </a>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {STATUS_TABS.map((tab) => {
          const count = tab === 'All'
            ? orders.length
            : orders.filter((o) => normalizeStatus(o.status) === tab.toLowerCase()).length
          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelected(new Set()) }}
              className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab} ({count})
            </button>
          )
        })}
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-600">{selected.size} selected</span>
          <input
            type="text"
            value={bulkTracking}
            onChange={(e) => setBulkTracking(e.target.value)}
            placeholder="Tracking # (optional)"
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            onClick={handleBulkShip}
            className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Mark as Shipped
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">Loading orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-gray-400 text-center py-12">No orders found.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredOrders.length && filteredOrders.length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Order #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Customer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Items</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
                  const displayStatus = normalizeStatus(order.status)
                  return (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{order.customerName}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-700">{itemCount}</td>
                      <td className="px-4 py-3 text-gray-700">{formatPrice(order.total)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={displayStatus}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className={`px-2 py-1 text-xs font-medium rounded-full border-0 cursor-pointer ${STATUS_COLORS[displayStatus] || 'bg-gray-100 text-gray-700'}`}
                        >
                          <option value="new">new</option>
                          <option value="packed">packed</option>
                          <option value="shipped">shipped</option>
                          <option value="done">done</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => copyAddress(order)}
                          className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                        >
                          {copiedId === order.id ? 'Copied!' : 'Copy Address'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
