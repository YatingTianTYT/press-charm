'use client'

/**
 * /admin/quick-upload — Press Charm's mobile-first PWA upload page.
 *
 * Workflow:
 *   1. User taps "Take Main Photo" → phone camera fires.
 *   2. Photo posts to /api/admin/auto-upload → product created as draft with
 *      AI-generated name/description/price/tags.
 *   3. Preview screen shows AI output. User can:
 *        - edit any field inline
 *        - tap "Regenerate" to re-run Claude Vision
 *        - shoot up to 2 supplementary photos
 *        - set stock per size via +/- counters (defaults are all 0)
 *   4. User taps "Publish" → POST /api/admin/publish/[id] flips status.
 *
 * Trust mode (toggle, persisted in localStorage):
 *   Skips the preview step. The product publishes immediately with whatever
 *   AI returned and stock=0/0/0/0. Quick path for "I already trust the AI for
 *   these batches, I'll set stock from the Today page or Products list."
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Size = 'XS' | 'S' | 'M' | 'L'
const SIZES: Size[] = ['XS', 'S', 'M', 'L']

interface ImageRow {
  id: string
  url: string
  position: number
}

interface Product {
  id: string
  name: string
  description: string
  price: number // cents
  tags: string // comma-separated
  features: string // JSON string array
  careInstructions: string
  stockXS: number
  stockS: number
  stockM: number
  stockL: number
  status: string
  images: ImageRow[]
}

const TRUST_MODE_KEY = 'press-charm-trust-mode'

export default function QuickUploadPage() {
  const [trustMode, setTrustMode] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [uploading, setUploading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const mainInputRef = useRef<HTMLInputElement>(null)
  const extraInputRef = useRef<HTMLInputElement>(null)

  // ---- restore trust mode from localStorage ----
  useEffect(() => {
    if (typeof window === 'undefined') return
    setTrustMode(localStorage.getItem(TRUST_MODE_KEY) === '1')
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(TRUST_MODE_KEY, trustMode ? '1' : '0')
  }, [trustMode])

  // ---- toast helper ----
  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  // ---- main photo upload ----
  async function handleMainPhoto(file: File) {
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      // (stock fields intentionally omitted — server defaults to 0)

      const res = await fetch('/api/admin/auto-upload', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed: HTTP ${res.status}`)
      }
      const data = await res.json()
      const draft: Product = data.product

      if (trustMode) {
        // Skip preview entirely: publish immediately and reset.
        await publishProduct(draft.id)
        flash(`✓ Published: ${draft.name}`)
      } else {
        setProduct(draft)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ---- supplementary photo ----
  async function handleExtraPhoto(file: File) {
    if (!file || !product) return
    setError('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/admin/products/${product.id}/image`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Add image failed: HTTP ${res.status}`)
      }
      const data = await res.json()
      setProduct({ ...product, images: [...product.images, data.image] })
      flash('Extra photo added')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add image failed')
    } finally {
      setUploading(false)
    }
  }

  async function removeImage(imageId: string) {
    if (!product) return
    if (product.images.length === 1) {
      setError("Can't remove the main photo — would leave the product imageless")
      return
    }
    try {
      const res = await fetch(`/api/admin/products/${product.id}/image?imageId=${imageId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      setProduct({ ...product, images: product.images.filter((i) => i.id !== imageId) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ---- regenerate AI ----
  async function regenerate() {
    if (!product) return
    setRegenerating(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/products/${product.id}/regenerate-listing`, {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Regenerate failed`)
      }
      const data = await res.json()
      setProduct(data.product)
      flash('AI re-ran successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regenerate failed')
    } finally {
      setRegenerating(false)
    }
  }

  // ---- save (PUT) ----
  async function saveDraft(opts: { silent?: boolean } = {}) {
    if (!product) return null
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: product.name,
        description: product.description,
        price: product.price,
        tags: product.tags,
        features: product.features,
        careInstructions: product.careInstructions,
        stockXS: product.stockXS,
        stockS: product.stockS,
        stockM: product.stockM,
        stockL: product.stockL,
        status: product.status,
        images: product.images.map((i, idx) => ({ url: i.url, position: idx })),
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Save failed`)
    }
    if (!opts.silent) flash('Draft saved')
    return await res.json()
  }

  // ---- publish ----
  async function publishProduct(productId: string) {
    const res = await fetch(`/api/admin/publish/${productId}`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || `Publish failed`)
    }
    return await res.json()
  }

  async function handlePublish() {
    if (!product) return
    setPublishing(true)
    setError('')
    try {
      await saveDraft({ silent: true })
      await publishProduct(product.id)
      flash(`✓ Published: ${product.name}`)
      setProduct(null) // reset for the next upload
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }

  // ---- field updaters ----
  function patchProduct(patch: Partial<Product>) {
    setProduct((p) => (p ? { ...p, ...patch } : p))
  }
  function bumpStock(size: Size, delta: number) {
    setProduct((p) => {
      if (!p) return p
      const field = `stock${size}` as keyof Product
      const current = p[field] as number
      const next = Math.max(0, current + delta)
      return { ...p, [field]: next }
    })
  }

  // ============== render ==============

  // ---- entry screen ----
  if (!product) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Quick Upload</h1>
          <label className="flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              checked={trustMode}
              onChange={(e) => setTrustMode(e.target.checked)}
              className="rounded"
            />
            Trust mode
          </label>
        </div>

        <p className="text-sm text-gray-500 mb-4 leading-relaxed">
          {trustMode
            ? '⚠ Trust mode is ON — uploads will publish immediately with the AI output and 0 stock. Set stock later from the product list.'
            : 'Snap a photo. AI will draft name + price + description. You\'ll review on the next screen.'}
        </p>

        <button
          onClick={() => mainInputRef.current?.click()}
          disabled={uploading}
          className="w-full p-8 bg-white border-2 border-dashed border-gray-300 rounded-3xl hover:border-gray-900 disabled:opacity-50 transition-all"
        >
          <div className="text-6xl mb-3">📷</div>
          <div className="text-lg font-semibold text-gray-900">
            {uploading ? 'Uploading…' : 'Take Main Photo'}
          </div>
          <div className="text-xs text-gray-500 mt-1">JPEG / PNG / HEIC — up to 10MB</div>
        </button>

        <input
          ref={mainInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleMainPhoto(f)
            e.target.value = '' // reset so same file can be retried
          }}
        />

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}
        {toast && (
          <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{toast}</div>
        )}

        <div className="mt-8 text-center">
          <Link href="/admin" className="text-sm text-gray-500 underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // ---- preview / edit screen ----
  const tagList = product.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const totalStock =
    product.stockXS + product.stockS + product.stockM + product.stockL

  return (
    <div className="max-w-md mx-auto pb-32">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setProduct(null)}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          ← Discard
        </button>
        <p className="text-xs text-gray-400">Draft · {product.id.slice(0, 8)}</p>
      </div>

      {/* images carousel */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 mb-4 snap-x">
        {product.images.map((img, idx) => (
          <div key={img.id} className="relative shrink-0 snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt=""
              className="w-48 h-48 object-cover rounded-2xl bg-gray-100"
            />
            {idx === 0 ? (
              <span className="absolute top-2 left-2 px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                Main
              </span>
            ) : (
              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-2 right-2 w-6 h-6 bg-white/90 border border-gray-200 rounded-full text-xs"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {product.images.length < 3 && (
          <button
            onClick={() => extraInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 w-48 h-48 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center text-gray-500 hover:border-gray-900 disabled:opacity-50"
          >
            {uploading ? '…' : '+ Add photo'}
          </button>
        )}
        <input
          ref={extraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleExtraPhoto(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* AI box */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-amber-800 uppercase tracking-wide">
            AI Suggestion
          </p>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="text-xs px-3 py-1 bg-white border border-amber-300 rounded-full text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {regenerating ? '…regenerating' : '↻ Regenerate'}
          </button>
        </div>

        <label className="block text-xs text-gray-500 mb-1">Name</label>
        <input
          type="text"
          value={product.name}
          onChange={(e) => patchProduct({ name: e.target.value })}
          className="w-full mb-3 px-3 py-2 bg-white border border-gray-200 rounded-lg text-base"
        />

        <label className="block text-xs text-gray-500 mb-1">Price (USD)</label>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-gray-500">$</span>
          <input
            type="number"
            min="0"
            step="0.5"
            value={(product.price / 100).toFixed(2)}
            onChange={(e) =>
              patchProduct({ price: Math.round(parseFloat(e.target.value || '0') * 100) })
            }
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-base"
          />
        </div>

        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <textarea
          value={product.description}
          onChange={(e) => patchProduct({ description: e.target.value })}
          rows={3}
          className="w-full mb-3 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm leading-relaxed"
        />

        {tagList.length > 0 && (
          <>
            <label className="block text-xs text-gray-500 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tagList.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 bg-white border border-amber-200 rounded-full text-xs text-amber-900"
                >
                  {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* stock */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900">Stock per size</p>
          <p className="text-xs text-gray-500">{totalStock} total</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SIZES.map((size) => {
            const field = `stock${size}` as keyof Product
            const value = product[field] as number
            return (
              <div
                key={size}
                className="flex flex-col items-center bg-gray-50 rounded-xl p-2"
              >
                <p className="text-xs text-gray-500 mb-1">{size}</p>
                <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => bumpStock(size, -1)}
                    className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-700 active:bg-gray-100"
                  >
                    −
                  </button>
                  <button
                    onClick={() => bumpStock(size, +1)}
                    className="w-7 h-7 rounded-full bg-gray-900 text-white active:bg-gray-700"
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* sticky footer with actions */}
      <div className="fixed inset-x-0 bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 z-10">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={() => saveDraft()}
            disabled={publishing}
            className="flex-1 py-3 border border-gray-300 rounded-2xl font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 py-3 bg-gray-900 text-white rounded-2xl font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {publishing ? 'Publishing…' : `Publish (${totalStock})`}
          </button>
        </div>
        {error && (
          <p className="max-w-md mx-auto mt-2 text-center text-red-600 text-xs">{error}</p>
        )}
        {toast && (
          <p className="max-w-md mx-auto mt-2 text-center text-green-700 text-xs">{toast}</p>
        )}
      </div>
    </div>
  )
}
