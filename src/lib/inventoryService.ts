import { getDb } from './db'
import { generateId, clampNonNegativeInt } from './id'
import type { StockMovement } from './types'

export async function stockIn(productId: string, quantity: number, reason: string): Promise<StockMovement> {
  return adjustStock(productId, quantity, 'stockin', reason)
}

export async function manualAdjustment(
  productId: string,
  quantityChange: number,
  reason: string,
): Promise<StockMovement> {
  return adjustStock(productId, quantityChange, 'adjustment', reason)
}

export function validateAdjustmentInput(
  quantityChange: number,
  reason: string,
): string | null {
  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    return 'Quantity change must be a non-zero number.'
  }
  if (!Number.isInteger(quantityChange)) {
    return 'Quantity change must be a whole number.'
  }
  if (Math.abs(quantityChange) > 9_999_999) {
    return 'Quantity change is too large.'
  }
  const trimmed = reason.trim()
  if (trimmed.length === 0) return 'A reason is required for stock changes.'
  if (trimmed.length > 300) return 'Reason is too long (max 300 characters).'
  return null
}

async function adjustStock(
  productId: string,
  quantityChange: number,
  type: 'stockin' | 'adjustment',
  reason: string,
): Promise<StockMovement> {
  const err = validateAdjustmentInput(quantityChange, reason)
  if (err) throw new Error(err)

  const db = await getDb()
  let movement: StockMovement | null = null

  await db.transaction('rw', db.products, db.stockMovements, async () => {
    const product = await db.products.get(productId)
    if (!product) throw new Error('Product not found.')

    const newStock = product.stock + quantityChange
    if (newStock < 0) {
      throw new Error(
        `Adjustment would make stock negative. Current: ${product.stock}, change: ${quantityChange}.`,
      )
    }

    const now = Date.now()
    await db.products.update(productId, { stock: newStock, updatedAt: now })
    movement = {
      id: generateId(),
      productId,
      productName: product.name,
      type,
      quantityChange,
      reason: reason.trim(),
      saleId: null,
      createdAt: now,
    }
    await db.stockMovements.add(movement)
  })

  if (!movement) throw new Error('Stock adjustment transaction did not complete.')
  return movement
}

export async function getMovementsForProduct(productId: string): Promise<StockMovement[]> {
  const db = await getDb()
  return db.stockMovements
    .where('productId')
    .equals(productId)
    .reverse()
    .sortBy('createdAt')
}

export async function getAllMovements(): Promise<StockMovement[]> {
  const db = await getDb()
  return db.stockMovements.reverse().sortBy('createdAt')
}

export async function reconcileStock(productId: string): Promise<{
  productStock: number
  computedStock: number
  matches: boolean
}> {
  const db = await getDb()
  const product = await db.products.get(productId)
  if (!product) throw new Error('Product not found.')
  const movements = await db.stockMovements.where('productId').equals(productId).toArray()
  const computed = movements.reduce((sum, m) => sum + m.quantityChange, 0)
  return {
    productStock: product.stock,
    computedStock: computed,
    matches: product.stock === computed,
  }
}
