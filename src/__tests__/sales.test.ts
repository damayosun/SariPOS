import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { getDb } from '../lib/db'
import {
  checkout,
  voidSale,
  validateCart,
  calcCartTotal,
  clearProcessedAttempts,
  type CartLine,
} from '../lib/salesService'
import { createProduct } from '../lib/productService'
import { getSettings, updateSettings } from '../lib/settingsService'

describe('Sales & Atomic Checkout', () => {
  beforeEach(async () => {
    clearProcessedAttempts()
    const db = await getDb()
    await Promise.all([
      db.products.clear(),
      db.categories.clear(),
      db.sales.clear(),
      db.saleItems.clear(),
      db.stockMovements.clear(),
      db.settings.clear(),
    ])
    await getSettings() // ensure settings singleton exists
  })

  it('validates cart items correctly', () => {
    expect(validateCart([])).toContain('empty')

    const invalidQty: CartLine[] = [
      { productId: '1', productName: 'Item', priceCentavos: 100, costCentavos: null, quantity: 0 },
    ]
    expect(validateCart(invalidQty)).toContain('Invalid quantity')

    const invalidPrice: CartLine[] = [
      { productId: '1', productName: 'Item', priceCentavos: -10, costCentavos: null, quantity: 1 },
    ]
    expect(validateCart(invalidPrice)).toContain('Invalid price')

    const valid: CartLine[] = [
      { productId: '1', productName: 'Item', priceCentavos: 500, costCentavos: null, quantity: 2 },
    ]
    expect(validateCart(valid)).toBeNull()
    expect(calcCartTotal(valid)).toBe(1000)
  })

  it('completes checkout atomically: deducts stock, creates sale, saleItems, and stock movements', async () => {
    const product = await createProduct({
      name: 'Lucky Me Pancit Canton',
      pricePeso: 18.5,
      stock: 50,
      sku: 'LMP-001',
    })

    const cart: CartLine[] = [
      {
        productId: product.id,
        productName: product.name,
        priceCentavos: product.priceCentavos, // 1850 centavos
        costCentavos: null,
        quantity: 3, // total 5550 centavos = ₱55.50
      },
    ]

    const result = await checkout(cart, 6000, 'attempt-1') // Customer gives ₱60.00 (6000 centavos)
    expect(result.sale).toBeDefined()
    expect(result.sale.receiptNo).toMatch(/^R-\d{8}-\d{4}$/)
    expect(result.sale.totalCentavos).toBe(5550)
    expect(result.sale.cashReceivedCentavos).toBe(6000)
    expect(result.sale.changeCentavos).toBe(450)
    expect(result.items).toHaveLength(1)
    expect(result.items[0].productName).toBe('Lucky Me Pancit Canton')

    // Verify product stock was safely decremented from 50 to 47
    const db = await getDb()
    const updatedProduct = await db.products.get(product.id)
    expect(updatedProduct?.stock).toBe(47)

    // Verify stock movement was recorded
    const movements = await db.stockMovements.where('productId').equals(product.id).toArray()
    expect(movements).toHaveLength(1)
    expect(movements[0].type).toBe('sale')
    expect(movements[0].quantityChange).toBe(-3)
    expect(movements[0].saleId).toBe(result.sale.id)
  })

  it('rejects checkout when cash received is less than total', async () => {
    const product = await createProduct({
      name: 'Coca-Cola 500ml',
      pricePeso: 35.0,
      stock: 20,
    })

    const cart: CartLine[] = [
      {
        productId: product.id,
        productName: product.name,
        priceCentavos: product.priceCentavos,
        costCentavos: null,
        quantity: 1,
      },
    ]

    // Total 3500 centavos, paying only 3000 centavos
    await expect(checkout(cart, 3000, 'attempt-insufficient')).rejects.toThrow(
      /Cash received is less than the total/,
    )
  })

  it('rejects checkout when requested quantity exceeds available stock', async () => {
    const product = await createProduct({
      name: 'Safeguard Soap',
      pricePeso: 45.0,
      stock: 2,
    })

    const cart: CartLine[] = [
      {
        productId: product.id,
        productName: product.name,
        priceCentavos: product.priceCentavos,
        costCentavos: null,
        quantity: 5, // Requested 5 but only 2 in stock
      },
    ]

    await expect(checkout(cart, 50000, 'attempt-out-of-stock')).rejects.toThrow(
      /Insufficient stock/,
    )

    // Stock should remain unchanged
    const db = await getDb()
    const p = await db.products.get(product.id)
    expect(p?.stock).toBe(2)
  })

  it('prevents duplicate checkouts using the same attempt ID', async () => {
    const product = await createProduct({
      name: 'Nissin Cup Noodles',
      pricePeso: 25.0,
      stock: 10,
    })

    const cart: CartLine[] = [
      {
        productId: product.id,
        productName: product.name,
        priceCentavos: product.priceCentavos,
        costCentavos: null,
        quantity: 1,
      },
    ]

    // First attempt succeeds
    await checkout(cart, 5000, 'same-tap-id')

    // Repeated tap with identical attemptId throws duplicate protection error
    await expect(checkout(cart, 5000, 'same-tap-id')).rejects.toThrow(
      /already processed/,
    )
  })

  it('voids a sale cleanly, reverses stock, and records void reason', async () => {
    const product = await createProduct({
      name: 'Bear Brand Milk Powder',
      pricePeso: 15.0,
      stock: 10,
    })

    const cart: CartLine[] = [
      {
        productId: product.id,
        productName: product.name,
        priceCentavos: product.priceCentavos,
        costCentavos: null,
        quantity: 2, // Stock will become 8
      },
    ]

    const { sale } = await checkout(cart, 3000, 'attempt-void-test')

    const db = await getDb()
    let p = await db.products.get(product.id)
    expect(p?.stock).toBe(8)

    // Void the sale
    await voidSale(sale.id, 'Customer changed mind and returned unopened pouches')

    // Verify sale status
    const updatedSale = await db.sales.get(sale.id)
    expect(updatedSale?.status).toBe('voided')
    expect(updatedSale?.voidReason).toContain('Customer changed mind')

    // Verify stock was restored from 8 back to 10
    p = await db.products.get(product.id)
    expect(p?.stock).toBe(10)

    // Verify void stock movement recorded
    const movements = await db.stockMovements.where('productId').equals(product.id).toArray()
    const voidMove = movements.find((m) => m.type === 'void')
    expect(voidMove).toBeDefined()
    expect(voidMove?.quantityChange).toBe(2)
  })

  it('uses custom receipt prefix configured by the user in settings', async () => {
    await updateSettings({
      receiptPrefix: 'SARI',
    })

    const product = await createProduct({
      name: 'SkyFlakes Crackers',
      pricePeso: 8.0,
      stock: 30,
    })

    const cart: CartLine[] = [
      {
        productId: product.id,
        productName: product.name,
        priceCentavos: product.priceCentavos,
        costCentavos: null,
        quantity: 1,
      },
    ]

    const result = await checkout(cart, 1000, 'attempt-custom-prefix')
    expect(result.sale.receiptNo).toMatch(/^SARI-\d{8}-\d{4}$/)
  })
})
