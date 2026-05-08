import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types'
import { Plus, Loader2 } from 'lucide-react'

export function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    sku: '',
    product_name: '',
    varietal: '',
    format: '',
    wholesale_price: '',
    suggested_retail: '',
    status: 'active' as const,
    description: '',
  })

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product_name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase.from('products').insert([{
        ...form,
        wholesale_price: form.wholesale_price ? parseFloat(form.wholesale_price) : undefined,
        suggested_retail: form.suggested_retail ? parseFloat(form.suggested_retail) : undefined,
      }])

      if (error) throw error
      setForm({
        sku: '',
        product_name: '',
        varietal: '',
        format: '',
        wholesale_price: '',
        suggested_retail: '',
        status: 'active',
        description: '',
      })
      setShowForm(false)
      fetchProducts()
    } catch (error) {
      console.error('Failed to save product:', error)
      alert('Failed to save product')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
        <p className="text-gray-600">Manage your wine product catalog</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#e94560] animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <p className="text-gray-600 mb-4">No products yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2.5 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Product
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{product.product_name}</h3>
                  <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                  {product.varietal && <p className="text-sm text-gray-600">{product.varietal}</p>}
                  {product.format && <p className="text-sm text-gray-600">Format: {product.format}</p>}
                </div>
                <div className="text-right">
                  {product.wholesale_price && (
                    <p className="text-sm text-gray-600">Wholesale: ${product.wholesale_price.toFixed(2)}</p>
                  )}
                  {product.suggested_retail && (
                    <p className="text-sm text-gray-600">Retail: ${product.suggested_retail.toFixed(2)}</p>
                  )}
                  <span className="inline-block mt-2 bg-green-100 text-green-800 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {product.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-24 md:bottom-8 right-4 w-14 h-14 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-full flex items-center justify-center shadow-lg transition-colors flex-shrink-0"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md mx-0 md:mx-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Add Product</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="SKU"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
                required
              />
              <input
                type="text"
                placeholder="Product Name"
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
                required
              />
              <input
                type="text"
                placeholder="Varietal (e.g., Cabernet Sauvignon)"
                value={form.varietal}
                onChange={(e) => setForm({ ...form, varietal: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
              <input
                type="text"
                placeholder="Format (e.g., 750ml)"
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Wholesale Price"
                  value={form.wholesale_price}
                  onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })}
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
                />
                <input
                  type="number"
                  placeholder="Suggested Retail"
                  value={form.suggested_retail}
                  onChange={(e) => setForm({ ...form, suggested_retail: e.target.value })}
                  step="0.01"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
                />
              </div>
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#e94560]/20 focus:border-[#e94560] outline-none"
                rows={2}
              />

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#e94560] hover:bg-[#d63d56] text-white rounded-lg px-4 py-2 font-medium transition-colors"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
