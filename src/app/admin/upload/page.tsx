'use client'

import { useState } from 'react'

interface AIResponse {
  title: string
  description: string
  price: number
  features: string[]
  careInstructions: string
}

export default function UploadPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [generatingHand, setGeneratingHand] = useState(false)

  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [features, setFeatures] = useState(['', '', '', ''])
  const [careInstructions, setCareInstructions] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setSuccess(null)
    setProductId(null)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(selected)
  }

  const handleGenerate = async () => {
    if (!file) return
    setGenerating(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/auto-upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to generate listing')
        return
      }
      const data = await res.json()
      const ai: AIResponse = data.aiResponse
      setProductId(data.product.id)
      setTitle(ai.title)
      setDescription(ai.description)
      setPrice((ai.price / 100).toFixed(2))
      const feats = ai.features || []
      setFeatures([feats[0] || '', feats[1] || '', feats[2] || '', feats[3] || ''])
      setCareInstructions(ai.careInstructions)
    } catch {
      setError('Failed to generate listing')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (publish: boolean) => {
    if (!productId) return
    setSaving(true)
    setError('')
    try {
      const body = {
        name: title.trim(),
        description: description.trim(),
        price: Math.round(parseFloat(price) * 100),
        status: publish ? 'published' : 'draft',
        features: JSON.stringify(features.filter(Boolean)),
        careInstructions: careInstructions.trim(),
      }
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSuccess(publish ? 'Published!' : 'Saved as draft!')
        // Reset for next upload
        setTimeout(() => {
          setImagePreview(null)
          setFile(null)
          setProductId(null)
          setTitle('')
          setDescription('')
          setPrice('')
          setFeatures(['', '', '', ''])
          setCareInstructions('')
          setSuccess(null)
        }, 2000)
      } else {
        setError('Failed to save product')
      }
    } catch {
      setError('Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const updateFeature = (index: number, value: string) => {
    setFeatures((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">AI Upload</h1>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-center font-medium">
          {success}
        </div>
      )}

      {/* Camera / File Input */}
      {!productId && (
        <div className="space-y-4">
          <label className="block w-full cursor-pointer">
            <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-400 transition-colors bg-white">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <>
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-500 text-sm">Tap to take photo or choose image</span>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>

          {imagePreview && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-4 bg-gray-900 text-white rounded-xl text-base font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors min-h-[48px]"
            >
              {generating ? 'Generating listing with AI...' : 'Generate Listing'}
            </button>
          )}
        </div>
      )}

      {/* Editable Form */}
      {productId && (
        <div className="space-y-5 mt-4">
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Product"
              className="w-full h-48 object-contain rounded-xl border border-gray-200"
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-vertical text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
            <div className="space-y-2">
              {features.map((feat, i) => (
                <input
                  key={i}
                  type="text"
                  value={feat}
                  onChange={(e) => updateFeature(i, e.target.value)}
                  placeholder={`Feature ${i + 1}`}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Care Instructions</label>
            <textarea
              value={careInstructions}
              onChange={(e) => setCareInstructions(e.target.value)}
              rows={2}
              className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-vertical text-base"
            />
          </div>

          {/* Generate Hand Model Button */}
          <button
            onClick={async () => {
              if (!productId) return
              setGeneratingHand(true)
              try {
                const res = await fetch('/api/admin/generate-hand-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ productId }),
                })
                if (res.ok) {
                  alert('Hand model image generated and added to product!')
                } else {
                  const data = await res.json()
                  if (data.error === 'Gemini API key not configured') return // silently hide
                  alert(data.error || 'Failed to generate hand model image')
                }
              } catch {
                alert('Failed to generate hand model image')
              } finally {
                setGeneratingHand(false)
              }
            }}
            disabled={generatingHand}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors min-h-[48px]"
          >
            {generatingHand ? 'Generating hand model image...' : 'Generate Hand Model Image (AI)'}
          </button>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 py-4 bg-green-600 text-white rounded-xl text-base font-medium hover:bg-green-700 disabled:opacity-50 transition-colors min-h-[48px]"
            >
              {saving ? 'Saving...' : 'Publish Now'}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 py-4 bg-gray-200 text-gray-800 rounded-xl text-base font-medium hover:bg-gray-300 disabled:opacity-50 transition-colors min-h-[48px]"
            >
              Save Draft
            </button>
          </div>
        </div>
      )}

      {error && !productId && <p className="text-red-600 text-sm mt-4">{error}</p>}
    </div>
  )
}
