import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, Plus, Minus, Trash2, ShoppingCart, AlertCircle, Package } from 'lucide-react'
import type { Category, Product } from '../lib/types'
import { searchProducts, getAllCategories } from '../lib/productService'
import { formatMoney, toCentavos, calcLineTotal, calcChange, isCashSufficient } from '../lib/money'
import { checkout, type CartLine, validateCart } from '../lib/salesService'
import { nextAttemptId } from '../lib/id'
import { getStockStatus } from '../lib/stockStatus'
import { getSettings } from '../lib/settingsService'
import { ReceiptModal } from './ReceiptModal'
import type { Tab } from '../App'

type CartItem = CartLine & { stockAvailable: number }

export function Checkout({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(10)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [cashInput, setCashInput] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const [prods, cats, st] = await Promise.all([
      searchProducts(query, activeCategory),
      getAllCategories(),
      getSettings().catch(() => null),
    ])
    setProducts(prods)
    setCategories(cats)
    if (st?.lowStockThreshold) {
      setLowStockThreshold(st.lowStockThreshold)
    }
  }, [query, activeCategory])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalCentavos = useMemo(
    () => cart.reduce((sum, l) => sum + calcLineTotal(l.priceCentavos, l.quantity), 0),
    [cart],
  )

  const cashCentavos = useMemo(() => {
    if (!cashInput) return 0
    const n = parseFloat(cashInput)
    if (!Number.isFinite(n) || n < 0) return NaN
    return toCentavos(n)
  }, [cashInput])

  const changeCentavos = useMemo(
    () => calcChange(cashCentavos, totalCentavos),
    [cashCentavos, totalCentavos],
  )

  const cashIsSufficient = useMemo(
    () => Number.isFinite(cashCentavos) && isCashSufficient(cashCentavos, totalCentavos),
    [cashCentavos, totalCentavos],
  )

  const cashInputInvalid = cashInput !== '' && !Number.isFinite(cashCentavos)

  const addToCart = (product: Product) => {
    setError('')
    if (product.stock <= 0) {
      setError(`${product.name} is out of stock.`)
      return
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Only ${product.stock} ${product.name} in stock.`)
          return prev
        }
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        priceCentavos: product.priceCentavos,
        costCentavos: null,
        quantity: 1,
        stockAvailable: product.stock,
      }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setError('')
    setCart((prev) =>
      prev.map((l) => {
        if (l.productId !== productId) return l
        const newQty = l.quantity + delta
        if (newQty <= 0) return l
        if (newQty > l.stockAvailable) {
          setError(`Only ${l.stockAvailable} ${l.productName} in stock.`)
          return l
        }
        return { ...l, quantity: newQty }
      }),
    )
  }

  const setDirectQty = (productId: string, val: string) => {
    setError('')
    const num = parseInt(val, 10)
    setCart((prev) =>
      prev.map((l) => {
        if (l.productId !== productId) return l
        if (isNaN(num) || num <= 0) {
          return { ...l, quantity: 1 }
        }
        if (num > l.stockAvailable) {
          setError(`Only ${l.stockAvailable} ${l.productName} in stock.`)
          return { ...l, quantity: l.stockAvailable }
        }
        return { ...l, quantity: num }
      }),
    )
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((l) => l.productId !== productId))
  }

  const handleCheckout = async () => {
    setError('')
    if (processing) return

    const cartErr = validateCart(cart)
    if (cartErr) {
      setError(cartErr)
      return
    }
    if (!cashIsSufficient) {
      setError('Cash received is less than the total. Please enter enough cash.')
      return
    }

    setProcessing(true)
    const attemptId = nextAttemptId()
    try {
      const result = await checkout(cart, cashCentavos, attemptId)
      setReceiptSaleId(result.sale.id)
      setCart([])
      setCashInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  const quickCashOptions = useMemo(() => {
    const opts: number[] = []
    const totalPeso = totalCentavos / 100
    if (totalPeso > 0) {
      opts.push(Math.ceil(totalPeso))
      opts.push(Math.ceil(totalPeso / 50) * 50)
      opts.push(Math.ceil(totalPeso / 100) * 100)
      opts.push(Math.ceil(totalPeso / 500) * 500)
    }
    opts.push(50, 100, 200, 500, 1000)
    return [...new Set(opts)].slice(0, 6).sort((a, b) => a - b)
  }, [totalCentavos])

  return (
    <div className="checkout-layout">
      {/* Product panel */}
      <div className="product-panel">
        <div className="panel-header">
          <h2>Products</h2>
        </div>
        <div className="search-row">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} />
            <input
              className="search-input"
              style={{ paddingLeft: 40 }}
              type="search"
              placeholder="Search by name or SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
          </div>
        </div>
        <div className="category-chips">
          <button
            className={`chip ${activeCategory === null ? 'active' : ''}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip ${activeCategory === c.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        {products.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <h3>No products found</h3>
            <p>{query ? 'Try a different search.' : 'Add products from the Products tab.'}</p>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((p) => {
              const stock = getStockStatus(p.stock, lowStockThreshold)
              return (
                <button
                  key={p.id}
                  className="product-card"
                  disabled={p.stock <= 0 || !p.active}
                  onClick={() => addToCart(p)}
                  title={p.sku ? `SKU: ${p.sku}` : p.name}
                >
                  <span className="pc-name">{p.name}</span>
                  <span className="pc-price">{formatMoney(p.priceCentavos)}</span>
                  <span className={`pc-stock ${stock.status}`}>
                    {stock.label} ({p.stock})
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Cart panel */}
      <div className="cart-panel">
        <div className="panel-header">
          <h2>Cart ({cart.length})</h2>
          {cart.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setCart([])}>
              Clear all
            </button>
          )}
        </div>

        {cart.length === 0 ? (
          <div className="empty-state" style={{ flex: 1 }}>
            <ShoppingCart size={48} />
            <h3>Cart is empty</h3>
            <p>Tap a product to add it.</p>
          </div>
        ) : (
          <div className="cart-items">
            {cart.map((item) => (
              <div key={item.productId} className="cart-item">
                <div className="ci-info">
                  <div className="ci-name">{item.productName}</div>
                  <div className="ci-price">
                    {formatMoney(item.priceCentavos)} × {item.quantity}
                  </div>
                </div>
                <div className="ci-qty">
                  <button
                    className="qty-btn"
                    onClick={() => changeQty(item.productId, -1)}
                    disabled={item.quantity <= 1}
                    aria-label={`Decrease ${item.productName} quantity`}
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={item.stockAvailable}
                    className="qty-input"
                    value={item.quantity}
                    onChange={(e) => setDirectQty(item.productId, e.target.value)}
                    aria-label={`Quantity for ${item.productName}`}
                    title="Directly edit quantity"
                  />
                  <button
                    className="qty-btn"
                    onClick={() => changeQty(item.productId, 1)}
                    disabled={item.quantity >= item.stockAvailable}
                    aria-label={`Increase ${item.productName} quantity`}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <span className="ci-line-total">{formatMoney(calcLineTotal(item.priceCentavos, item.quantity))}</span>
                <button className="ci-remove" onClick={() => removeFromCart(item.productId)} aria-label={`Remove ${item.productName}`}>
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="cart-summary">
          <div className="summary-row">
            <span className="label">Subtotal</span>
            <span className="value">{formatMoney(totalCentavos)}</span>
          </div>
          <div className="summary-row summary-total">
            <span className="label">Total</span>
            <span className="value">{formatMoney(totalCentavos)}</span>
          </div>
        </div>

        {cart.length > 0 && (
          <div className="payment-section">
            <div className="cash-input-row">
              <label htmlFor="cash-input">Cash received</label>
              <div className="cash-input-wrap">
                <span className="peso-sign">₱</span>
                <input
                  id="cash-input"
                  className={`cash-input ${cashInputInvalid || (!cashIsSufficient && cashInput !== '') ? 'insufficient' : ''}`}
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  aria-label="Cash received"
                />
              </div>
            </div>
            <div className="quick-cash">
              {quickCashOptions.map((amt) => (
                <button key={amt} className="quick-cash-btn" onClick={() => setCashInput(String(amt))}>
                  ₱{amt}
                </button>
              ))}
            </div>
            {cashInput !== '' && cashIsSufficient && (
              <div className="change-row">
                <span className="label">Change</span>
                <span className="value">{formatMoney(changeCentavos)}</span>
              </div>
            )}
            {error && (
              <div className="alert alert-error">
                <AlertCircle />
                <span>{error}</span>
              </div>
            )}
            <button
              className="checkout-btn"
              disabled={processing || !cashIsSufficient || cart.length === 0}
              onClick={handleCheckout}
            >
              {processing ? 'Processing…' : `Complete Sale — ${formatMoney(totalCentavos)}`}
            </button>
          </div>
        )}
      </div>

      {receiptSaleId && (
        <ReceiptModal saleId={receiptSaleId} onClose={() => { setReceiptSaleId(null); onNavigate('history') }} />
      )}
    </div>
  )
}
