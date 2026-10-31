import { getDb } from './db'
import { generateId, generateReceiptNo } from './id'
import { calcLineTotal, calcChange, isCashSufficient } from './money'
import type { Product, Sale, SaleItem, StockMovement } from './types'

export type CartLine = {
  productId: string
  productName: string
  priceCentavos: number
  costCentavos: number | null
  quantity: number
}

export type CheckoutResult = {
  sale: Sale
  items: SaleItem[]
}

const processedAttempts = new Set<string>()

export function clearProcessedAttempts(): void {
  processedAttempts.clear()
}

export function validateCart(lines: CartLine[]): string | null {
  if (lines.length === 0) return 'Cart is empty. Add products before checkout.'
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return `Invalid quantity for "${line.productName}".`
    }
    if (!Number.isFinite(line.priceCentavos) || line.priceCentavos < 0) {
      return `Invalid price for "${line.productName}".`
    }
  }
  return null
}

export function calcCartTotal(lines: CartLine[]): number {
  return lines.reduce(
    (sum, l) => sum + calcLineTotal(l.priceCentavos, l.quantity),
    0,
  )
}

export async function checkout(
  cartLines: CartLine[],
  cashReceivedCentavos: number,
  attemptId: string,
): Promise<CheckoutResult> {
  if (!attemptId) throw new Error('Checkout attempt ID is required.')

  if (processedAttempts.has(attemptId)) {
    throw new Error('This checkout was already processed. Check sales history.')
  }

  const cartErr = validateCart(cartLines)
  if (cartErr) throw new Error(cartErr)

  if (!Number.isInteger(cashReceivedCentavos) || cashReceivedCentavos < 0) {
    throw new Error('Cash received is invalid.')
  }

  const totalCentavos = calcCartTotal(cartLines)

  if (!isCashSufficient(cashReceivedCentavos, totalCentavos)) {
    throw new Error('Cash received is less than the total. Cannot complete checkout.')
  }

  const db = await getDb()

  let result: CheckoutResult | null = null

  await db.transaction(
    'rw',
    db.products,
    db.sales,
    db.saleItems,
    db.stockMovements,
    db.settings,
    async () => {
      const settings = await db.settings.get('singleton')
      if (!settings) throw new Error('Settings not initialized.')

      const productMap = new Map<string, Product>()
      for (const line of cartLines) {
        const product = await db.products.get(line.productId)
        if (!product) throw new Error(`Product "${line.productName}" not found.`)
        if (product.stock < line.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${line.quantity}.`,
          )
        }
        if (productMap.has(line.productId)) {
          throw new Error('Duplicate product in cart. Each product should appear once.')
        }
        productMap.set(line.productId, product)
      }

      const saleId = generateId()
      const receiptSeq = settings.lastReceiptSeq + 1
      const receiptNo = generateReceiptNo(receiptSeq, settings.receiptPrefix || 'R')
      const now = Date.now()

      const items: SaleItem[] = []
      for (const line of cartLines) {
        const product = productMap.get(line.productId)!
        const lineTotal = calcLineTotal(line.priceCentavos, line.quantity)
        items.push({
          id: generateId(),
          saleId,
          productId: product.id,
          productName: product.name,
          priceCentavos: line.priceCentavos,
          costCentavos: line.costCentavos,
          quantity: line.quantity,
          lineTotalCentavos: lineTotal,
        })
      }

      const changeCentavos = calcChange(cashReceivedCentavos, totalCentavos)

      const sale: Sale = {
        id: saleId,
        receiptNo,
        status: 'completed',
        totalCentavos,
        cashReceivedCentavos,
        changeCentavos,
        itemCount: items.length,
        createdAt: now,
        voidedAt: null,
        voidReason: null,
      }

      await db.sales.add(sale)
      await db.saleItems.bulkAdd(items)

      const stockMovements: StockMovement[] = []
      for (const line of cartLines) {
        const product = productMap.get(line.productId)!
        const newStock = product.stock - line.quantity
        await db.products.update(line.productId, { stock: newStock, updatedAt: now })
        stockMovements.push({
          id: generateId(),
          productId: product.id,
          productName: product.name,
          type: 'sale',
          quantityChange: -line.quantity,
          reason: `Sale ${receiptNo}`,
          saleId,
          createdAt: now,
        })
      }
      await db.stockMovements.bulkAdd(stockMovements)

      await db.settings.put({
        ...settings,
        lastReceiptSeq: receiptSeq,
        updatedAt: now,
      })

      result = { sale, items }
    },
  )

  if (!result) throw new Error('Checkout transaction did not complete.')
  processedAttempts.add(attemptId)
  return result
}

export async function voidSale(saleId: string, reason: string): Promise<void> {
  const trimmed = reason.trim()
  if (trimmed.length === 0) throw new Error('A reason is required to void a sale.')
  if (trimmed.length > 300) throw new Error('Void reason is too long (max 300 characters).')

  const db = await getDb()

  await db.transaction(
    'rw',
    db.sales,
    db.saleItems,
    db.products,
    db.stockMovements,
    async () => {
      const sale = await db.sales.get(saleId)
      if (!sale) throw new Error('Sale not found.')
      if (sale.status === 'voided') throw new Error('This sale is already voided.')

      const items = await db.saleItems.where('saleId').equals(saleId).toArray()
      const now = Date.now()

      for (const item of items) {
        const product = await db.products.get(item.productId)
        if (!product) continue
        const restoredStock = product.stock + item.quantity
        await db.products.update(item.productId, { stock: restoredStock, updatedAt: now })
        await db.stockMovements.add({
          id: generateId(),
          productId: item.productId,
          productName: item.productName,
          type: 'void',
          quantityChange: item.quantity,
          reason: `Void of ${sale.receiptNo}: ${trimmed}`,
          saleId,
          createdAt: now,
        })
      }

      await db.sales.update(saleId, {
        status: 'voided',
        voidedAt: now,
        voidReason: trimmed,
      })
    },
  )
}
