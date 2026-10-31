import { useCallback, useEffect, useState } from 'react'
import {
  Boxes,
  CheckCircle,
  AlertCircle,
  Search,
  PlusCircle,
  Sliders,
  History,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { Product, StockMovement } from '../lib/types'
import { getAllProducts } from '../lib/productService'
import {
  stockIn,
  manualAdjustment,
  getAllMovements,
  reconcileStock,
} from '../lib/inventoryService'
import { getStockStatus } from '../lib/stockStatus'

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'levels' | 'movements'>('levels')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [adjustMode, setAdjustMode] = useState<'stockin' | 'adjustment' | null>(null)
  const [reconcileResult, setReconcileResult] = useState<{
    productId: string
    productName: string
    productStock: number
    computedStock: number
    matches: boolean
  } | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [prods, moves] = await Promise.all([getAllProducts(), getAllMovements()])
      setProducts(prods)
      setMovements(moves)
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to load inventory data.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredProducts = products.filter((p) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
  })

  const filteredMovements = movements.filter((m) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return m.productName.toLowerCase().includes(q) || m.reason.toLowerCase().includes(q)
  })

  const handleOpenStockIn = (product: Product) => {
    setSelectedProduct(product)
    setAdjustMode('stockin')
  }

  const handleOpenAdjustment = (product: Product) => {
    setSelectedProduct(product)
    setAdjustMode('adjustment')
  }

  const handleReconcile = async (product: Product) => {
    try {
      const res = await reconcileStock(product.id)
      setReconcileResult({
        productId: product.id,
        productName: product.name,
        ...res,
      })
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to reconcile product stock.',
      })
    }
  }

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <h1>Inventory Management</h1>
          <div className="category-chips">
            <button
              className={`chip ${activeTab === 'levels' ? 'active' : ''}`}
              onClick={() => setActiveTab('levels')}
            >
              <Boxes size={14} style={{ marginRight: 4 }} /> Stock Levels
            </button>
            <button
              className={`chip ${activeTab === 'movements' ? 'active' : ''}`}
              onClick={() => setActiveTab('movements')}
            >
              <History size={14} style={{ marginRight: 4 }} /> Movement Log ({movements.length})
            </button>
          </div>
        </div>

        {feedback && (
          <div className={`alert alert-${feedback.type}`}>
            {feedback.type === 'success' ? <CheckCircle /> : <AlertCircle />}
            <span>{feedback.message}</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto', padding: '2px 6px' }}
              onClick={() => setFeedback(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="section-card">
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }}
            />
            <input
              className="search-input"
              style={{ paddingLeft: 40 }}
              type="search"
              placeholder={
                activeTab === 'levels'
                  ? 'Search stock levels by product name or SKU…'
                  : 'Search movements by product name or reason…'
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search inventory"
            />
          </div>
        </div>

        {activeTab === 'levels' ? (
          <div className="table-wrap">
            {loading ? (
              <div className="loading">
                <div className="spinner" /> Loading stock records…
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="empty-state">
                <Boxes size={48} />
                <h3>No products found</h3>
                <p>Add products in the Products tab first.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th className="t-num">Current Stock</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Stock Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const status = getStockStatus(p.stock)
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td className="t-mono">{p.sku || '—'}</td>
                        <td className="t-num" style={{ fontWeight: 700, fontSize: 16 }}>
                          {p.stock}
                        </td>
                        <td>
                          <span className={`pill ${status.status}`}>
                            {status.label}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenStockIn(p)}
                            title="Add newly received stock"
                          >
                            <PlusCircle size={14} /> Stock In
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ marginLeft: 6 }}
                            onClick={() => handleOpenAdjustment(p)}
                            title="Adjust quantity manually"
                          >
                            <Sliders size={14} /> Adjust
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ marginLeft: 6 }}
                            onClick={() => handleReconcile(p)}
                            title="Audit history vs current stock"
                          >
                            <ShieldCheck size={14} /> Reconcile
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            {loading ? (
              <div className="loading">
                <div className="spinner" /> Loading movement audit trail…
              </div>
            ) : filteredMovements.length === 0 ? (
              <div className="empty-state">
                <History size={48} />
                <h3>No movement history recorded</h3>
                <p>Sales, stock-ins, and manual adjustments will appear here.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="t-num">Change</th>
                    <th>Reason / Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {new Date(m.createdAt).toLocaleString('en-PH')}
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.productName}</td>
                      <td>
                        <span
                          className={`pill ${
                            m.type === 'stockin' || m.type === 'void' ? 'completed' : 'low'
                          }`}
                        >
                          {m.type === 'stockin'
                            ? 'Stock In'
                            : m.type === 'void'
                              ? 'Void Reversal'
                              : m.type === 'sale'
                                ? 'Sale'
                                : 'Adjustment'}
                        </span>
                      </td>
                      <td
                        className="t-num"
                        style={{
                          fontWeight: 700,
                          color: m.quantityChange > 0 ? 'var(--success)' : 'var(--error)',
                        }}
                      >
                        {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                      </td>
                      <td style={{ color: 'var(--text)' }}>
                        {m.reason}
                        {m.saleId && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                            (Linked)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Stock In / Adjustment Modal */}
      {selectedProduct && adjustMode && (
        <AdjustStockModal
          product={selectedProduct}
          mode={adjustMode}
          onClose={() => {
            setSelectedProduct(null)
            setAdjustMode(null)
          }}
          onSuccess={(msg) => {
            setSelectedProduct(null)
            setAdjustMode(null)
            setFeedback({ type: 'success', message: msg })
            loadData()
          }}
        />
      )}

      {/* Reconcile Modal */}
      {reconcileResult && (
        <div className="modal-overlay" onClick={() => setReconcileResult(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Inventory Reconciliation</h2>
              <button
                className="modal-close"
                onClick={() => setReconcileResult(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div
                className={`alert alert-${reconcileResult.matches ? 'success' : 'error'}`}
              >
                {reconcileResult.matches ? <CheckCircle /> : <AlertCircle />}
                <span>
                  {reconcileResult.matches
                    ? 'Audit Passed: Current stock matches recorded history perfectly.'
                    : 'Disparity detected between current stock and recorded movements.'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Product:</span>
                  <span style={{ fontWeight: 600 }}>{reconcileResult.productName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current Product Table Stock:</span>
                  <span style={{ fontWeight: 700 }}>{reconcileResult.productStock} units</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sum of Movement Records:</span>
                  <span style={{ fontWeight: 700 }}>{reconcileResult.computedStock} units</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span
                    className={`pill ${reconcileResult.matches ? 'ok' : 'out'}`}
                  >
                    {reconcileResult.matches ? 'Reconciled (OK)' : 'Discrepancy'}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setReconcileResult(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AdjustStockModal({
  product,
  mode,
  onClose,
  onSuccess,
}: {
  product: Product
  mode: 'stockin' | 'adjustment'
  onClose: () => void
  onSuccess: (message: string) => void
}) {
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(mode === 'stockin' ? 'Received stock from distributor' : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const num = parseInt(qty, 10)
    if (!Number.isInteger(num) || num === 0) {
      setError('Please enter a valid non-zero whole number.')
      return
    }

    if (mode === 'stockin' && num <= 0) {
      setError('Stock in quantity must be a positive number.')
      return
    }

    if (mode === 'adjustment' && product.stock + num < 0) {
      setError(
        `Adjustment would make stock negative. Current stock is ${product.stock}, cannot subtract ${Math.abs(num)}.`,
      )
      return
    }

    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError('A reason is required for any stock adjustment.')
      return
    }

    setSaving(true)
    try {
      if (mode === 'stockin') {
        await stockIn(product.id, num, trimmedReason)
        onSuccess(`Successfully added ${num} unit(s) to ${product.name}.`)
      } else {
        await manualAdjustment(product.id, num, trimmedReason)
        onSuccess(`Adjusted ${product.name} by ${num > 0 ? `+${num}` : num} units.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stock operation failed.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2>
              {mode === 'stockin' ? `Stock In: ${product.name}` : `Adjust Stock: ${product.name}`}
            </h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: 'var(--text-muted)' }}>Current Available Stock:</span>
              <span style={{ fontWeight: 700 }}>{product.stock} units</span>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="qty-input">
                {mode === 'stockin' ? 'Quantity to Add *' : 'Quantity Change (+/-) *'}
              </label>
              <input
                id="qty-input"
                className="form-input"
                type="number"
                inputMode="numeric"
                step="1"
                placeholder={mode === 'stockin' ? 'e.g. 24' : 'e.g. -2 for damaged, +5 for found'}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                autoFocus
              />
              {mode === 'adjustment' && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Use a negative number to reduce stock (e.g., -1 for spoiled item).
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="reason-input">Reason *</label>
              <input
                id="reason-input"
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Delivered by Puregold, Damaged packaging, Audit recount"
                maxLength={300}
                required
              />
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !qty}
            >
              {saving ? 'Saving…' : mode === 'stockin' ? 'Add Stock' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
