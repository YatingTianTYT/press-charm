'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

interface UploadedImage {
  id?: string
  url: string
}

interface Product {
  id: string
  name: string
  description: string
  price: number
  compareAtPrice: number | null
  category: string
  tags: string
  featured: boolean
  stockXS: number
  stockS: number
  stockM: number
  stockL: number
  images: { id: string; url: string; position: number }[]
}

export default function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [compareAtPrice, setCompareAtPrice] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [featured, setFeatured] = useState(false)
  const [stockXS, setStockXS] = useState('0')
  const [stockS, setStockS] = useState('0')
  const [stockM, setStockM] = useState('0')
  const [stockL, setStockL] = useState('0')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [generatingHand, setGeneratingHand] = useState(false)

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${id}`)
        if (!res.ok) {
          setError('Product not found')
          return
        }
        const product: Product = await res.json()
        setName(product.name)
        setDescription(product.description || '')
        setPrice((product.price / 100).toFixed(2))
        setCompareAtPrice(product.compareAtPrice ? (product.compareAtPrice / 100).toFixed(2) : '')
        setCategory(product.category || '')
        setTags(product.tags || '')
        setFeatured(product.featured)
        setStockXS(String(product.stockXS))
        setStockS(String(product.stockS))
        setStockM(String(product.stockM))
        setStockL(String(product.stockL))
        setImages(product.images.map((img) => ({ id: img.id, url: img.url })))
      } catch {
        setError('Failed to load product')
      } finally {
        setLoading(false)
      }
    }
    fetchProduct()
  }, [id])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const remaining = 3 - images.length
    if (remaining <= 0) {
      alert('Maximum 3 images allowed')
      return
    }

    const filesToUpload = Array.from(files).slice(0, remaining)
    setUploading(true)

    try {
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setImages((prev) => [...prev, { url: data.url }])
        } else {
          alert('Failed to upload image')
        }
      }
    } catch {
      alert('Failed to upload image')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Product name is required')
      return
    }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      setError('Valid price is required')
      return
    }

    setSaving(true)

    try {
      const body = {
        name: name.trim(),
        description: description.trim(),
        price: Math.round(parseFloat(price) * 100),
        compareAtPrice: compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : null,
        category: category.trim(),
        tags: tags.trim(),
        featured,
        stockXS: parseInt(stockXS) || 0,
        stockS: parseInt(stockS) || 0,
        stockM: parseInt(stockM) || 0,
        stockL: parseInt(stockL) || 0,
        images: images.map((img) => ({ url: img.url })),
      }

      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.push('/admin/products')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update product')
      }
    } catch {
      setError('Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/products')
      } else {
        alert('Failed to delete product')
      }
    } catch {
      alert('Failed to delete product')
    }
  }

  if (loading) {
    return <div className="text-gray-400">Loading product...</div>
  }

  if (error && !name) {
    return <div className="text-red-600">{error}</div>
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Edit Product</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-vertical"
          />
        </div>

        {/* Price row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compare-at Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={compareAtPrice}
              onChange={(e) => setCompareAtPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Category and Tags */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="e.g. floral, glitter"
            />
          </div>
        </div>

        {/* Featured */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="featured"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <label htmlFor="featured" className="text-sm font-medium text-gray-700">
            Featured product
          </label>
        </div>

        {/* Stock */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Stock by Size</label>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'XS', value: stockXS, setter: setStockXS },
              { label: 'S', value: stockS, setter: setStockS },
              { label: 'M', value: stockM, setter: setStockM },
              { label: 'L', value: stockL, setter: setStockL },
            ].map((size) => (
              <div key={size.label}>
                <label className="block text-xs text-gray-500 mb-1 text-center">{size.label}</label>
                <input
                  type="number"
                  min="0"
                  value={size.value}
                  onChange={(e) => size.setter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Images ({images.length}/3)
          </label>
          <div className="flex flex-wrap gap-3 mb-3">
            {images.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={img.url}
                  alt={`Image ${index + 1}`}
                  className="w-24 h-24 rounded-lg object-cover border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {images.length < 3 && (
              <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                {uploading ? 'Uploading...' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
            {images.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  setGeneratingHand(true)
                  try {
                    const res = await fetch('/api/admin/generate-hand-image', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ productId: id }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      setImages((prev) => [...prev, { url: data.url }])
                    } else {
                      const data = await res.json()
                      if (data.error !== 'Gemini API key not configured') {
                        alert(data.error || 'Failed to generate')
                      }
                    }
                  } catch {
                    alert('Failed to generate hand model image')
                  } finally {
                    setGeneratingHand(false)
                  }
                }}
                disabled={generatingHand}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {generatingHand ? 'Generating...' : 'Generate Hand Model'}
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/products')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Delete */}
      <div className="mt-10 pt-6 border-t border-red-100">
        <button
          onClick={handleDelete}
          className="px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          Delete Product
        </button>
      </div>
    </div>
  )
}
