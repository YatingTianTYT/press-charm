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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

type Size = 'XS' | 'S' | 'M' | 'L'
const SIZES: Size[] = ['XS', 'S', 'M', 'L']

// Mirrors src/lib/claude.ts. Kept inline so this page is self-contained.
const STYLE_TAGS = ['Floral', 'Glitter', 'French', 'Minimal', 'Art', 'Ombre', 'Gems']
const VIBE_TAGS = ['Elegant', 'Cute', 'Bold']
const COLOR_TAGS = [
  'Pink', 'Red', 'Nude', 'White', 'Black', 'Blue', 'Green',
  'Purple', 'Gold', 'Silver', 'Multicolor',
]

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
  const [generatingHand, setGeneratingHand] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  // Progress phases for the synchronous upload flow:
  //   idle      → no upload in flight
  //   analyzing → photo uploaded, Claude Vision running (~3-5s)
  //   rendering → Claude done, Gemini hand model running (~10-20s)
  //   done      → success, transitioning to preview
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'rendering' | 'done'>('idle')

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

  // ---- main photo upload (synchronous: wait for Claude AND Gemini) ----
  // User asked to wait for the hand model before being shown the preview, so
  // both AI steps complete before we reveal the editing screen. If Gemini
  // fails or takes >35s we still show the preview so they can recover with
  // the manual "Re-render hand" button.
  async function handleMainPhoto(file: File) {
    if (!file) return
    setError('')
    setUploading(true)
    setPhase('analyzing')
    try {
      // Step 1: Claude Vision — turns the photo into a draft listing
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/auto-upload', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Upload failed: HTTP ${res.status}`)
      }
      const { product: draft } = await res.json() as { product: Product }

      // Step 2: Gemini — render the hand-model image. Bounded by 35s so a
      // hung Gemini call doesn't strand the user.
      setPhase('rendering')
      let finalProduct: Product = draft
      try {
        const handImage = await generateHandModelWithTimeout(draft.id, 35_000)
        if (handImage) {
          finalProduct = {
            ...draft,
            images: [...draft.images, handImage],
          }
        }
      } catch (handErr) {
        // Non-fatal: we still want the user to see the preview and recover
        const msg = handErr instanceof Error ? handErr.message : 'Hand model failed'
        flash(`⚠ ${msg} — use Re-render to retry`)
      }

      setPhase('done')

      if (trustMode) {
        // Skip preview entirely: publish whatever we have and reset.
        await publishProduct(finalProduct.id)
        flash(`✓ Published: ${finalProduct.name}`)
      } else {
        setProduct(finalProduct)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPhase('idle')
      setUploading(false)
    }
  }

  // ---- Gemini hand-model image (with timeout) ----
  // Returns the new image row, or throws on failure / timeout.
  async function generateHandModelWithTimeout(
    productId: string,
    timeoutMs: number,
  ): Promise<ImageRow | null> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch('/api/admin/generate-hand-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Hand model failed (HTTP ${res.status})`)
      }
      const data = await res.json()
      return { id: data.imageId, url: data.url, position: 1 }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error('Hand model timed out after 35s')
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
  }

  // ---- manual re-render button on the preview screen ----
  async function regenerateHandModel() {
    if (!product) return
    setGeneratingHand(true)
    setError('')
    try {
      const newImage = await generateHandModelWithTimeout(product.id, 35_000)
      if (newImage) {
        setProduct((p) =>
          p ? { ...p, images: [...p.images, { ...newImage, position: p.images.length }] } : p,
        )
        flash('Hand model added')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-render failed')
    } finally {
      setGeneratingHand(false)
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

  function toggleTag(tag: string) {
    setProduct((p) => {
      if (!p) return p
      const current = p.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const next = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag]
      return { ...p, tags: next.join(', ') }
    })
  }

  // Features are stored as a JSON string. The UI works with a parsed array.
  const featuresList = useMemo<string[]>(() => {
    if (!product) return []
    try {
      const parsed = JSON.parse(product.features || '[]')
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }, [product])

  function patchFeature(index: number, value: string) {
    setProduct((p) => {
      if (!p) return p
      const list = [...featuresList]
      while (list.length <= index) list.push('')
      list[index] = value
      return { ...p, features: JSON.stringify(list.filter((s) => s !== '' || true)) }
    })
  }

  // ============== render ==============

  // ---- entry screen ----
  if (!product) {
    // Full-screen progress while we wait for Claude + Gemini
    if (uploading || phase === 'analyzing' || phase === 'rendering') {
      return (
        <div className="max-w-md mx-auto pt-24 text-center">
          <div className="text-7xl mb-6 animate-pulse">
            {phase === 'rendering' ? '✋' : '🪞'}
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            {phase === 'rendering' ? 'Rendering hand model…' : 'Analyzing your nails…'}
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {phase === 'rendering'
              ? 'Gemini is generating a hand-model photo. Usually 10–20 seconds.'
              : 'Claude is writing the product name, price, and description.'}
          </p>

          <div className="space-y-2 max-w-xs mx-auto text-left">
            <Step
              label="Analyze nails (Claude)"
              done={phase === 'rendering' || phase === 'done'}
              active={phase === 'analyzing'}
            />
            <Step
              label="Render hand model (Gemini)"
              done={phase === 'done'}
              active={phase === 'rendering'}
            />
          </div>
        </div>
      )
    }

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
            ? '⚠ Trust mode is ON — uploads will publish immediately once Claude + Gemini finish. Stock starts at 0; dial it in from the product list later.'
            : 'Snap a photo. Claude drafts a listing, Gemini renders a hand-model image. We\'ll wait for both before showing you the preview.'}
        </p>

        <button
          onClick={() => mainInputRef.current?.click()}
          disabled={uploading}
          className="w-full p-8 bg-white border-2 border-dashed border-gray-300 rounded-3xl hover:border-gray-900 disabled:opacity-50 transition-all"
        >
          <div className="text-6xl mb-3">📷</div>
          <div className="text-lg font-semibold text-gray-900">Take Main Photo</div>
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

        {/* hand-model placeholder while Gemini is rendering */}
        {generatingHand && (
          <div className="shrink-0 w-48 h-48 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-dashed border-amber-300 flex flex-col items-center justify-center text-center px-3">
            <div className="text-3xl mb-2 animate-pulse">✋</div>
            <p className="text-sm font-medium text-amber-900">Rendering hand model…</p>
            <p className="text-xs text-amber-700 mt-1">Gemini ~ 15s</p>
          </div>
        )}

        {/* manual retry if Gemini failed */}
        {!generatingHand && product.images.length < 3 && (
          <button
            onClick={regenerateHandModel}
            className="shrink-0 w-32 h-48 border border-amber-300 bg-amber-50 rounded-2xl flex flex-col items-center justify-center text-amber-900 text-xs"
          >
            <span className="text-2xl mb-1">✋</span>
            Re-render hand
          </button>
        )}

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

        <label className="block text-xs text-gray-500 mb-1">Tags</label>
        <TagGroup
          label="Style"
          options={STYLE_TAGS}
          selected={tagList}
          onToggle={toggleTag}
        />
        <TagGroup
          label="Vibe"
          options={VIBE_TAGS}
          selected={tagList}
          onToggle={toggleTag}
        />
        <TagGroup
          label="Colors"
          options={COLOR_TAGS}
          selected={tagList}
          onToggle={toggleTag}
        />
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

      {/* features */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <p className="text-sm font-semibold text-gray-900 mb-2">Features</p>
        <p className="text-xs text-gray-500 mb-3">
          Bullet points shown on the product page — handpicked highlights.
        </p>
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              type="text"
              value={featuresList[i] ?? ''}
              onChange={(e) => patchFeature(i, e.target.value)}
              placeholder={`Feature ${i + 1}`}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
            />
          ))}
        </div>
      </div>

      {/* care instructions */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <p className="text-sm font-semibold text-gray-900 mb-2">Care instructions</p>
        <textarea
          value={product.careInstructions}
          onChange={(e) => patchProduct({ careInstructions: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm leading-relaxed"
          placeholder="e.g. Avoid hot water for 1 hour after application."
        />
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

/** One toggleable group of tag chips (Style / Vibe / Colors). */
function TagGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (tag: string) => void
}) {
  return (
    <div className="mb-3">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((tag) => {
          const on = selected.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggle(tag)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                on
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Single row of the two-step progress checklist on the loading screen. */
function Step({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  const dotClass = done
    ? 'bg-green-500 text-white'
    : active
      ? 'bg-amber-500 text-white animate-pulse'
      : 'bg-gray-200 text-gray-500'
  const labelClass = done
    ? 'text-gray-900'
    : active
      ? 'text-gray-900 font-medium'
      : 'text-gray-400'
  return (
    <div className="flex items-center gap-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${dotClass}`}>
        {done ? '✓' : active ? '·' : ''}
      </span>
      <span className={`text-sm ${labelClass}`}>{label}</span>
    </div>
  )
}
