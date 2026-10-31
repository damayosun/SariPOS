export const LOW_STOCK_THRESHOLD = 10

export function getStockStatus(stock: number): {
  status: 'out' | 'low' | 'ok'
  label: string
} {
  if (stock <= 0) return { status: 'out', label: 'Out of stock' }
  if (stock <= LOW_STOCK_THRESHOLD) return { status: 'low', label: 'Low stock' }
  return { status: 'ok', label: 'In stock' }
}
