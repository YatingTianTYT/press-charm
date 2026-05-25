'use client'

/**
 * /admin/sell — Market Mode home page.
 *
 * Designed to be the first thing the operator sees when she taps "Sell" on
 * the PWA at a farmers market. Three ways to find a product:
 *   1. Type its shortCode in the big input (e.g. "42" or "s-42") and Enter
 *   2. Visually scan the recent-sellers row at the top (hot hand-picked)
 *   3. Scroll the thumbnail grid below (all in-stock products)
 *
 * Search box also accepts a partial name as a fallback when she can't
 * remember the number.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SellProduct {
  id: string
  shortCode: number | null
  name: string
  price: number
  image: string | null
  tags: string[]
  stock: { XS: number; S: number; M: number; L: number }
  lastSoldAt: string | null
  isHotRecent: boolean
  createdAt: string
}

const formatCode = (n: number | null) =>
  n == null ? '???' : `#${String(n).padStart(3, '0')}`

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

export default function SellHomePage() {
  const router = useRouter()
  const [products, setProducts] = useState<SellProduct[] | null>(null)
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [lookupErr, setLookupErr] = useState('')
  const [lookupBusy, setLookupBusy] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // ---- load list ----
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/active-products')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!cancelled) setProducts(d.products)
      })
      .catch(() => {
        if (!cancelled) setProducts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ---- handle GO button / Enter ----
  const lookup = useCallback(
    async (q: string) => {
      if (!q.trim()) return
      setLookupErr('')
      setLookupBusy(true)
      try {
        const res = await fetch(`/api/admin/lookup-shortcode?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json()
          // If the input had a size prefix (s-042), pass it as a query so
          // the sell screen pre-selects the size.
          const url = data.size
            ? `/admin/sell/${data.productId}?size=${data.size}`
            : `/admin/sell/${data.productId}`
          router.push(url)
        } else {
          const data = await res.json().catch(() => ({}))
          // Fall back to name search — maybe she typed a partial name
          const lowered = q.trim().toLowerCase()
          const match = products?.find((p) =>
            p.name.toLowerCase().includes(lowered),
          )
          if (match) {
            router.push(`/admin/sell/${match.id}`)
          } else {
            setLookupErr(data.error || `No match for "${q}"`)
          }
        }
      } finally {
        setLookupBusy(false)
      }
    },
    [products, router],
  )

  // ---- derived: filtered list ----
  const allTags = useMemo(() => {
    if (!products) return []
    const set = new Set<string>()
    for (const p of products) for (const t of p.tags) set.add(t)
    return Array.from(set).sort()
  }, [products])

  const filtered = useMemo(() => {
    if (!products) return []
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (activeTags.length && !activeTags.every((t) => p.tags.includes(t))) {
        return false
      }
      if (!q) return true
      if (p.name.toLowerCase().includes(q)) return true
      if (p.shortCode != null && String(p.shortCode).includes(q.replace(/\D/g, ''))) return true
      return false
    })
  }, [products, search, activeTags])

  const hotRecent = useMemo(
    () => (products ? products.filter((p) => p.isHotRecent) : []),
    [products],
  )

  // ---- render ----
  if (products === null) {
    return <div className="text-gray-400 p-8 text-center">Loading…</div>
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* shortCode lookup */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1">
          Type a code or name — Enter to jump
        </label>
        <div className="flex gap-2">
          <input
            ref={searchRef}
            type="text"
            inputMode="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') lookup(search)
            }}
            placeholder="42  ·  s-42  ·  cherry blossom"
            className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 rounded-2xl text-xl tracking-wider focus:border-gray-900 focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => lookup(search)}
            disabled={lookupBusy}
            className="px-5 py-3 bg-gray-900 text-white rounded-2xl font-semibold disabled:opacity-50"
          >
            {lookupBusy ? '…' : 'GO'}
          </button>
        </div>
        {lookupErr && (
          <p className="mt-2 text-sm text-red-600">{lookupErr}</p>
        )}
      </div>

      {/* tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allTags.map((tag) => {
            const on = activeTags.includes(tag)
            return (
              <button
                key={tag}
                onClick={() =>
                  setActiveTags((t) =>
                    t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag],
                  )
                }
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  on
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {tag}
              </button>
            )
          })}
          {activeTags.length > 0 && (
            <button
              onClick={() => setActiveTags([])}
              className="text-xs text-gray-500 underline ml-1"
            >
              clear
            </button>
          )}
        </div>
      )}

      {/* hot recent row */}
      {hotRecent.length > 0 && !search && activeTags.length === 0 && (
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
            ⭐ Recent sellers (24h)
          </h2>
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 snap-x">
            {hotRecent.map((p) => (
              <ProductCard key={p.id} product={p} compact />
            ))}
          </div>
        </section>
      )}

      {/* main grid */}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-2">
          {search || activeTags.length ? `Filtered (${filtered.length})` : `All active (${products.length})`}
        </h2>
        {filtered.length === 0 ? (
          <p className="text-gray-400 py-8 text-center">No products match.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 text-center">
        <Link
          href="/admin/today"
          className="text-sm text-gray-500 underline"
        >
          View today's sales
        </Link>
      </div>
    </div>
  )
}

/** Tappable product card. Goes straight to /admin/sell/[id]. */
function ProductCard({ product, compact }: { product: SellProduct; compact?: boolean }) {
  const total =
    product.stock.XS + product.stock.S + product.stock.M + product.stock.L
  const sizeChips = (['XS', 'S', 'M', 'L'] as const).map((s) => {
    const n = product.stock[s]
    return (
      <span
        key={s}
        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          n > 0 ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'
        }`}
      >
        {s}:{n}
      </span>
    )
  })

  return (
    <Link
      href={`/admin/sell/${product.id}`}
      className={`block bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-900 transition-colors ${
        compact ? 'shrink-0 w-44 snap-start' : ''
      }`}
    >
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt={product.name}
          className="w-full aspect-square object-cover"
        />
      ) : (
        <div className="w-full aspect-square bg-gray-100" />
      )}
      <div className="p-2">
        <div className="flex items-baseline justify-between gap-1 mb-0.5">
          <span className="font-mono text-sm font-bold text-gray-900">
            {formatCode(product.shortCode)}
          </span>
          <span className="text-xs text-gray-600">{formatPrice(product.price)}</span>
        </div>
        <p className="text-xs text-gray-700 line-clamp-1 mb-1.5">{product.name}</p>
        <div className="flex flex-wrap gap-1">{sizeChips}</div>
        <p className="text-[10px] text-gray-400 mt-1">{total} left</p>
      </div>
    </Link>
  )
}
