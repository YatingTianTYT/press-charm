'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewDiscount() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [code, setCode] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('')
  const [minOrder, setMinOrder] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!code.trim()) {
      setError('Code is required')
      return
    }
    if (!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0) {
      setError('Valid value is required')
      return
    }

    setSaving(true)

    try {
      const body: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        type,
        value: type === 'fixed' ? Math.round(parseFloat(value) * 100) : parseFloat(value),
        minOrder: minOrder ? Math.round(parseFloat(minOrder) * 100) : null,
        expiresAt: expiresAt || null,
      }

      const res = await fetch('/api/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.push('/admin/discounts')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create discount')
      }
    } catch {
      setError('Failed to create discount')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Add Discount Code</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Code */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent uppercase"
            placeholder="e.g. SAVE20"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'percent' | 'fixed')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
          >
            <option value="percent">Percentage (%)</option>
            <option value="fixed">Fixed Amount ($)</option>
          </select>
        </div>

        {/* Value */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Value ({type === 'percent' ? '%' : '$'}) *
          </label>
          <input
            type="number"
            step={type === 'percent' ? '1' : '0.01'}
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            placeholder={type === 'percent' ? 'e.g. 20' : 'e.g. 5.00'}
          />
        </div>

        {/* Min order */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Order Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={minOrder}
            onChange={(e) => setMinOrder(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            placeholder="Optional"
          />
        </div>

        {/* Expiry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating...' : 'Create Discount'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/discounts')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
