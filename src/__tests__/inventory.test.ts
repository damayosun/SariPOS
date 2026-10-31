import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { getDb } from '../lib/db'
import { createProduct } from '../lib/productService'
import {
  stockIn,
  manualAdjustment,
  reconcileStock,
  validateAdjustmentInput,
} from '../lib/inventoryService'

describe('Inventory & Stock Movements', () => {
  beforeEach(async () => {
    const db = await getDb()
    await Promise.all([
      db.products.clear(),
      db.stockMovements.clear(),
    ])
  })

  it('validates adjustment input correctly', () => {
    expect(validateAdjustmentInput(0, 'Reason')).toContain('non-zero')
    expect(validateAdjustmentInput(5, '   ')).toContain('reason is required')
    expect(validateAdjustmentInput(2.5, 'Reason')).toContain('whole number')
    expect(validateAdjustmentInput(10, 'Valid delivery')).toBeNull()
  })

  it('handles stock-in correctly and records movement', async () => {
    const product = await createProduct({
      name: 'Milo 22g Sachet',
      pricePeso: 12.0,
      stock: 10,
    })

    const move = await stockIn(product.id, 24, 'Supplier delivery from market')
    expect(move.type).toBe('stockin')
    expect(move.quantityChange).toBe(24)
    expect(move.reason).toBe('Supplier delivery from market')

    const db = await getDb()
    const updated = await db.products.get(product.id)
    expect(updated?.stock).toBe(34) // 10 + 24
  })

  it('handles manual negative adjustment and rejects adjustments that cause negative stock', async () => {
    const product = await createProduct({
      name: 'Magic Sarap 8g',
      pricePeso: 6.0,
      stock: 5,
    })

    // Reduce by 2 due to damage
    await manualAdjustment(product.id, -2, 'Damaged sachets')
    const db = await getDb()
    let p = await db.products.get(product.id)
    expect(p?.stock).toBe(3)

    // Attempting to subtract 10 when stock is 3 should throw
    await expect(manualAdjustment(product.id, -10, 'Excess reduction')).rejects.toThrow(
      /would make stock negative/,
    )

    // Stock stays at 3
    p = await db.products.get(product.id)
    expect(p?.stock).toBe(3)
  })

  it('reconciles stock against recorded movements', async () => {
    const product = await createProduct({
      name: 'San Miguel Pale Pilsen',
      pricePeso: 65.0,
      stock: 0,
    })

    // Add 12
    await stockIn(product.id, 12, 'Initial delivery')
    // Adjust -2 (breakage)
    await manualAdjustment(product.id, -2, 'Broken bottles during transit')
    // Stock is now 10

    const rec = await reconcileStock(product.id)
    expect(rec.productStock).toBe(10)
    expect(rec.computedStock).toBe(10)
    expect(rec.matches).toBe(true)
  })
})
