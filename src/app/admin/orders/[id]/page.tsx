'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

interface OrderItem {
  id: string
  name: string
  size: string
  quantity: number
  price: number
  product?: {
    id: string
    images?: { url: string }[]
  }
}

interface Order {
  id: string
  orderNumber: string
  customerName: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  status: string
  trackingNumber: string
  subtotal: number
  shipping: number
  discount: number
  total: number
  discountCode: string | null
  createdAt: string
  items: OrderItem[]
}

const STATUS_OPTIONS = ['new', 'packed', 'shipped', 'done']
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

export default function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [trackingInput, setTrackingInput] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch('/api/orders')
        if (res.ok) {
          const orders: Order[] = await res.json()
          const found = orders.find((o) => o.id === id)
          setOrder(found || null)
          if (found?.trackingNumber) setTrackingInput(found.trackingNumber)
        }
      } catch (err) {
        console.error('Failed to fetch order:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrder()
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return
    setUpdating(true)
    try {
      const body: { status: string; trackingNumber?: string } = { status: newStatus }
      if (newStatus === 'shipped' && trackingInput.trim()) {
        body.trackingNumber = trackingInput.trim()
      }
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json()
        setOrder({ ...order, status: updated.status, trackingNumber: updated.trackingNumber || '' })
      } else {
        alert('Failed to update order')
      }
    } catch {
      alert('Failed to update order')
    } finally {
      setUpdating(false)
    }
  }

  const saveTracking = async () => {
    if (!order) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: trackingInput.trim() }),
      })
      if (res.ok) {
        setOrder({ ...order, trackingNumber: trackingInput.trim() })
      }
    } catch {
      alert('Failed to save tracking number')
    } finally {
      setUpdating(false)
    }
  }

  const copyAddress = async () => {
    if (!order) return
    const parts = [
      order.customerName,
      order.addressLine1,
      order.addressLine2,
      `${order.city}, ${order.state} ${order.zipCode}`,
    ].filter(Boolean)
    await navigator.clipboard.writeText(parts.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) return <div className="text-gray-400">Loading order...</div>
  if (!order) return <div className="text-red-600">Order not found</div>

  const displayStatus = normalizeStatus(order.status)
  const address = [
    order.addressLine1,
    order.addressLine2,
    `${order.city}, ${order.state} ${order.zipCode}`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/orders" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Orders
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Order {order.orderNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">{formatDate(order.createdAt)}</p>
        </div>
        <select
          value={displayStatus}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={updating}
          className={`px-3 py-1.5 text-sm font-medium rounded-full border-0 cursor-pointer ${STATUS_COLORS[displayStatus] || 'bg-gray-100 text-gray-700'}`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Customer Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Customer</h2>
          <p className="font-medium text-gray-900">{order.customerName}</p>
          <p className="text-sm text-gray-600 mt-1">{order.email}</p>
          {order.phone && <p className="text-sm text-gray-600">{order.phone}</p>}
        </div>

        {/* Shipping Address */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500">Shipping Address</h2>
            <button
              onClick={copyAddress}
              className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
          </div>
          <p className="text-sm text-gray-900 whitespace-pre-line">{address}</p>
        </div>
      </div>

      {/* Tracking Number */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-500 mb-3">Tracking Number</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="Enter tracking number"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            onClick={saveTracking}
            disabled={updating}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
        {order.trackingNumber && (
          <p className="text-sm text-gray-600 mt-2">
            Current: <span className="font-mono">{order.trackingNumber}</span>
          </p>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-medium text-gray-500">Items</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-2 font-medium text-gray-500">Product</th>
              <th className="text-left px-5 py-2 font-medium text-gray-500">Size</th>
              <th className="text-left px-5 py-2 font-medium text-gray-500">Qty</th>
              <th className="text-right px-5 py-2 font-medium text-gray-500">Price</th>
              <th className="text-right px-5 py-2 font-medium text-gray-500">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="px-5 py-3 text-gray-900">{item.name}</td>
                <td className="px-5 py-3 text-gray-600">{item.size}</td>
                <td className="px-5 py-3 text-gray-600">{item.quantity}</td>
                <td className="px-5 py-3 text-gray-600 text-right">{formatPrice(item.price)}</td>
                <td className="px-5 py-3 text-gray-900 text-right font-medium">
                  {formatPrice(item.price * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Shipping</span>
            <span className="text-gray-900">{formatPrice(order.shipping)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">
                Discount{order.discountCode ? ` (${order.discountCode})` : ''}
              </span>
              <span className="text-green-600">-{formatPrice(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t border-gray-200 font-medium">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
