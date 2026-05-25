'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Size = 'XS' | 'S' | 'M' | 'L'
type PaymentMethod = 'cash' | 'venmo' | 'card'

interface ProductInfo {
  id: string
  name: string
  price: number // cents
  images: string[]
  stock: Record<Size, number>
}

const SIZES: Size[] = ['XS', 'S', 'M', 'L']

const PAYMENT_OPTIONS: { method: PaymentMethod; label: string; emoji: string; sub: string }[] = [
  { method: 'cash', label: 'Cash', emoji: '💵', sub: 'Got the money in hand' },
  { method: 'venmo', label: 'Venmo', emoji: '📱', sub: 'Customer scanned & paid' },
  { method: 'card', label: 'Tap to Pay', emoji: '💳', sub: 'Stripe card / Apple Pay' },
]

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default function MarketSellPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  // Optional ?size=S query — when arriving from a "s-042" shortCode the user
  // has already implicitly picked the size, so we skip the picker and go
  // straight to the payment screen.
  const presetSize = searchParams.get('size')?.toUpperCase() as Size | null

  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedSize, setSelectedSize] = useState<Size | null>(
    presetSize && ['XS', 'S', 'M', 'L'].includes(presetSize) ? presetSize : null,
  )
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // ---- load product ----
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/sell?productId=${encodeURIComponent(id)}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const data: ProductInfo = await res.json()
        if (!cancelled) setProduct(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  // ---- post-success auto bounce ----
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => {
      router.push('/admin/products')
    }, 2000)
    return () => clearTimeout(t)
  }, [success, router])

  async function recordSale(method: PaymentMethod) {
    if (!selectedSize || !product || submitting) return
    setSubmitting(true)
    setError('')
    try {
      // NOTE: for `card` we currently don't have Tap-to-Pay wired up.
      // Phase 2 will collect a stripePaymentIntentId here and pass it through.
      const res = await fetch('/api/admin/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          size: selectedSize,
          paymentMethod: method,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sale failed')

      setProduct((p) =>
        p
          ? {
              ...p,
              stock: { ...p.stock, [selectedSize]: data.remainingStock },
            }
          : p,
      )
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sale failed')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- states ----
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-lg text-gray-400">Loading...</div>
  }
  if (error && !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-600 text-lg">{error}</p>
        <Link href="/admin/products" className="text-gray-600 underline">
          Back to products
        </Link>
      </div>
    )
  }
  if (!product) return null

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-green-50 p-6">
        <div className="text-7xl">✓</div>
        <p className="text-2xl font-semibold text-green-800">Sold!</p>
        <p className="text-gray-600">Stock updated. Going back…</p>
      </div>
    )
  }

  const totalRemaining = SIZES.reduce((sum, s) => sum + product.stock[s], 0)
  const allSoldOut = totalRemaining === 0

  // ---- step 2: payment ----
  if (selectedSize) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="px-4 h-14 flex items-center justify-between">
            <button
              onClick={() => setSelectedSize(null)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <p className="text-sm text-gray-500">Market Mode</p>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">{product.name}</p>
            <p className="text-xl text-gray-700">Size {selectedSize}</p>
            <p className="text-4xl font-bold text-gray-900 mt-2">{formatPrice(product.price)}</p>
          </div>

          <p className="text-center text-gray-600 mb-4">How did they pay?</p>

          <div className="space-y-3">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.method}
                onClick={() => recordSale(opt.method)}
                disabled={submitting || opt.method === 'card'} // card disabled until Stripe Tap-to-Pay wired
                className="w-full p-5 bg-white border-2 border-gray-200 rounded-2xl text-left hover:border-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{opt.emoji}</span>
                  <div className="flex-1">
                    <p className="text-lg font-semibold text-gray-900">{opt.label}</p>
                    <p className="text-sm text-gray-500">
                      {opt.method === 'card' ? 'Coming soon — Stripe Tap-to-Pay' : opt.sub}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 text-center text-red-600 text-sm">{error}</p>
          )}

          {submitting && (
            <p className="mt-4 text-center text-gray-500 text-sm">Recording…</p>
          )}
        </main>
      </div>
    )
  }

  // ---- step 1: pick size ----
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link href="/admin/products" className="text-sm text-gray-600 hover:text-gray-900">
            ← Back
          </Link>
          <p className="text-sm text-gray-500">Market Mode</p>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-md w-full mx-auto">
        {product.images[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full aspect-square object-cover rounded-2xl mb-4 bg-white"
          />
        )}

        <h1 className="text-2xl font-bold text-gray-900 mb-1">{product.name}</h1>
        <p className="text-xl text-gray-700 mb-6">{formatPrice(product.price)}</p>

        <p className="text-sm text-gray-500 mb-3">Pick the size you're selling:</p>

        <div className="grid grid-cols-2 gap-3">
          {SIZES.map((size) => {
            const remaining = product.stock[size]
            const out = remaining <= 0
            return (
              <button
                key={size}
                onClick={() => !out && setSelectedSize(size)}
                disabled={out}
                className={`p-6 rounded-2xl border-2 transition-all ${
                  out
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border-gray-300 hover:border-gray-900 active:bg-gray-100'
                }`}
              >
                <p className="text-3xl font-bold text-gray-900">{size}</p>
                <p className={`mt-2 text-sm ${out ? 'text-gray-400' : 'text-gray-600'}`}>
                  {out ? 'Sold out' : `${remaining} left`}
                </p>
              </button>
            )
          })}
        </div>

        {allSoldOut && (
          <p className="mt-6 text-center text-gray-500">This product is fully sold out.</p>
        )}

        <div className="mt-8 text-center">
          <Link href="/admin/today" className="text-sm text-gray-500 hover:text-gray-900 underline">
            View today's sales
          </Link>
        </div>
      </main>
    </div>
  )
}
