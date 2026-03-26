'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ProductImage {
  id: string
  url: string
  position: number
}

interface Product {
  id: string
  name: string
  price: number
  compareAtPrice: number | null
  category: string
  tags: string
  featured: boolean
  stockXS: number
  stockS: number
  stockM: number
  stockL: number
  status: string
  images: ProductImage[]
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      if (res.ok) {
        setProducts(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handlePublish = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/publish/${id}`, { method: 'POST' })
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'published' } : p))
        )
      } else {
        alert('Failed to publish product')
      }
    } catch {
      alert('Failed to publish product')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id))
      } else {
        alert('Failed to delete product')
      }
    } catch {
      alert('Failed to delete product')
    }
  }

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Products</h1>
        <Link
          href="/admin/products/new"
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Add Product
        </Link>
      </div>

      {loading ? (
        <div className="text-gray-400">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="text-gray-400 text-center py-12">No products yet.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Image</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Stock</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Featured</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const totalStock = product.stockXS + product.stockS + product.stockM + product.stockL
                  const thumbnail = product.images?.[0]?.url

                  return (
                    <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={product.name}
                            className="w-10 h-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            --
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-gray-700">{formatPrice(product.price)}</td>
                      <td className="px-4 py-3 text-gray-500">{product.category || '--'}</td>
                      <td className="px-4 py-3 text-gray-700">{totalStock}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                            product.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {product.status}
                        </span>
                        {product.status === 'draft' && (
                          <button
                            onClick={() => handlePublish(product.id)}
                            className="ml-2 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-300 rounded-md hover:bg-green-50 transition-colors"
                          >
                            Publish
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {product.featured && (
                          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                            Featured
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="px-3 py-1 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
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
