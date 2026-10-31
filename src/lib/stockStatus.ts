export const LOW_STOCK_THRESHOLD = 10

export function getStockStatus(stock: number, customThreshold: number = LOW_STOCK_THRESHOLD): {
  status: 'out' | 'low' | 'ok'
  label: string
} {
  if (stock <= 0) return { status: 'out', label: 'Out of stock' }
  const threshold = customThreshold > 0 ? customThreshold : LOW_STOCK_THRESHOLD
  if (stock <= threshold) return { status: 'low', label: 'Low stock' }
  return { status: 'ok', label: 'In stock' }
}
