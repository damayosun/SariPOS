import { useCallback, useEffect, useState } from 'react'
import { Search, Plus, Pencil, Tag, Package, AlertCircle, Trash2, X } from 'lucide-react'
import type { Category, Product } from '../lib/types'
import { searchProducts, getAllCategories, createProduct, updateProduct, deactivateProduct, activateProduct, validateProductName, validatePricePeso, validateStock, createCategory, deleteCategory } from '../lib/productService'
import { formatMoney } from '../lib/money'
import { getStockStatus } from '../lib/stockStatus'

export function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([searchProducts(query, activeCategory), getAllCategories()])
      setProducts(showInactive ? prods : prods.filter((p) => p.active))
      setCategories(cats)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products.')
    }
  }, [query, activeCategory, showInactive])

  useEffect(() => { load() }, [load])

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <h1>Products</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowCategories(true)}>
              <Tag size={16} /> Categories
            </button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Product
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error"><AlertCircle /><span>{error}</span></div>}

        <div className="section-card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
              <input
                className="search-input"
                style={{ paddingLeft: 40 }}
                type="search"
                placeholder="Search products by name or SKU…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search products"
              />
            </div>
            <label className="chip" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ marginRight: 6 }} />
              Show inactive
            </label>
          </div>
          <div className="category-chips">
            <button className={`chip ${activeCategory === null ? 'active' : ''}`} onClick={() => setActiveCategory(null)}>All</button>
            {categories.map((c) => (
              <button key={c.id} className={`chip ${activeCategory === c.id ? 'active' : ''}`} onClick={() => setActiveCategory(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrap">
          {products.length === 0 ? (
            <div className="empty-state">
              <Package size={48} />
              <h3>No products yet</h3>
              <p>Add your first product to start selling.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="t-num">Price</th>
                  <th className="t-num">Stock</th>
                  <th>Status</th>
                  <th>SKU</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId)
                  const stock = getStockStatus(p.stock)
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{cat?.name ?? '—'}</td>
                      <td className="t-num">{formatMoney(p.priceCentavos)}</td>
                      <td className="t-num">
                        <span className={`pill ${stock.status}`}>{p.stock} · {stock.label}</span>
                      </td>
                      <td>
                        <span className={`pill ${p.active ? 'active' : 'inactive'}`}>
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="t-mono">{p.sku ?? '—'}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingProduct(p)}>
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            if (p.active) { await deactivateProduct(p.id) } else { await activateProduct(p.id) }
                            load()
                          }}
                        >
                          {p.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {(showAdd || editingProduct) && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          onClose={() => { setShowAdd(false); setEditingProduct(null) }}
          onSaved={() => { setShowAdd(false); setEditingProduct(null); load() }}
        />
      )}

      {showCategories && (
        <CategoryModal
          categories={categories}
          products={products}
          onClose={() => setShowCategories(false)}
          onChanged={load}
        />
      )}
    </div>
  )
}

function ProductModal({ product, categories, onClose, onSaved }: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? '')
  const [pricePeso, setPricePeso] = useState(product ? String(product.priceCentavos / 100) : '')
  const [stock, setStock] = useState(product ? String(product.stock) : '0')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const newErrors: Record<string, string> = {}
    const nameErr = validateProductName(name)
    if (nameErr) newErrors.name = nameErr
    const priceErr = validatePricePeso(parseFloat(pricePeso) || 0)
    if (priceErr) newErrors.price = priceErr
    const stockNum = parseInt(stock, 10)
    const stockErr = validateStock(stockNum)
    if (stockErr) newErrors.stock = stockErr
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    setSaving(true)
    try {
      if (product) {
        await updateProduct(product.id, {
          name,
          categoryId: categoryId || null,
          pricePeso: parseFloat(pricePeso) || 0,
          sku: sku || null,
          active: product.active,
        })
      } else {
        await createProduct({
          name,
          categoryId: categoryId || null,
          pricePeso: parseFloat(pricePeso) || 0,
          stock: stockNum,
          sku: sku || null,
        })
      }
      onSaved()
    } catch (e) {
      setErrors({ form: e instanceof Error ? e.message : 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{product ? 'Edit Product' : 'Add Product'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-body">
          {errors.form && <div className="alert alert-error"><AlertCircle /><span>{errors.form}</span></div>}
          <div className="form-group">
            <label htmlFor="p-name">Name</label>
            <input id="p-name" className={`form-input ${errors.name ? 'error' : ''}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="p-price">Selling Price (₱)</label>
              <input id="p-price" className={`form-input ${errors.price ? 'error' : ''}`} type="number" inputMode="decimal" step="0.01" value={pricePeso} onChange={(e) => setPricePeso(e.target.value)} />
              {errors.price && <span className="form-error">{errors.price}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="p-stock">Initial Stock</label>
              <input id="p-stock" className={`form-input ${errors.stock ? 'error' : ''}`} type="number" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} disabled={!!product} />
              {errors.stock && <span className="form-error">{errors.stock}</span>}
              {product && <span className="form-error" style={{ color: 'var(--text-muted)' }}>Use Inventory tab to adjust stock for existing products.</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="p-cat">Category</label>
              <select id="p-cat" className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="p-sku">SKU / Barcode (optional)</label>
              <input id="p-sku" className="form-input" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={40} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CategoryModal({ categories, products, onClose, onChanged }: {
  categories: Category[]
  products: Product[]
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleAdd = async () => {
    try {
      await createCategory(name)
      setName('')
      setError('')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add category.')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id)
      setConfirmDeleteId(null)
      setError('')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Categories</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error"><AlertCircle /><span>{error}</span></div>}
          <div className="form-group">
            <label htmlFor="cat-name">Add new category</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="cat-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Beverages" />
              <button className="btn btn-primary" onClick={handleAdd}><Plus size={16} /> Add</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {categories.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No categories yet.</p>
            ) : categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length
              const isConfirming = confirmDeleteId === c.id
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>{c.name} {count > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({count} items)</span>}</span>
                  {isConfirming ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--error)' }}>Remove?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Yes, Delete</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDeleteId(c.id)} aria-label={`Delete ${c.name}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
