import { getDb } from './db'
import type { Sale, SaleItem } from './types'

export async function getSalesByDateRange(start: number, end: number): Promise<Sale[]> {
  const db = await getDb()
  const all = await db.sales.toArray()
  return all
    .filter((s) => s.createdAt >= start && s.createdAt < end)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getSalesByDay(year: number, month: number, day: number): Promise<Sale[]> {
  const start = new Date(year, month, day, 0, 0, 0, 0).getTime()
  const end = new Date(year, month, day + 1, 0, 0, 0, 0).getTime()
  return getSalesByDateRange(start, end)
}

export async function getAllSales(): Promise<Sale[]> {
  const db = await getDb()
  return db.sales.reverse().sortBy('createdAt')
}

export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
  const db = await getDb()
  return db.saleItems.where('saleId').equals(saleId).toArray()
}

export type DailyReport = {
  date: string
  grossSales: number
  voidedSales: number
  netSales: number
  transactionCount: number
  completedCount: number
  voidedCount: number
}

export async function getDailyReport(year: number, month: number, day: number): Promise<DailyReport> {
  const sales = await getSalesByDay(year, month, day)
  const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  let grossSales = 0
  let voidedSales = 0
  let completedCount = 0
  let voidedCount = 0
  for (const s of sales) {
    if (s.status === 'completed') {
      grossSales += s.totalCentavos
      completedCount += 1
    } else {
      voidedSales += s.totalCentavos
      voidedCount += 1
    }
  }
  return {
    date: dateStr,
    grossSales,
    voidedSales,
    netSales: grossSales,
    transactionCount: sales.length,
    completedCount,
    voidedCount,
  }
}

export async function getDailyReportRange(start: Date, end: Date): Promise<DailyReport[]> {
  const reports: DailyReport[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  while (cursor.getTime() <= endMs) {
    const report = await getDailyReport(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())
    reports.push(report)
    cursor.setDate(cursor.getDate() + 1)
  }
  return reports
}

export type TopProduct = {
  productId: string
  productName: string
  quantitySold: number
  totalRevenueCentavos: number
}

export type CategoryRevenue = {
  categoryId: string | null
  categoryName: string
  totalRevenueCentavos: number
  quantitySold: number
  percentage: number
}

export async function getTopSellingProducts(
  start: number,
  end: number,
  limit: number = 10,
): Promise<TopProduct[]> {
  const db = await getDb()
  const sales = await db.sales.toArray()
  const completedSales = sales.filter((s) => s.status === 'completed' && s.createdAt >= start && s.createdAt <= end)
  const completedSaleIds = new Set(completedSales.map((s) => s.id))

  const allItems = await db.saleItems.toArray()
  const relevantItems = allItems.filter((i) => completedSaleIds.has(i.saleId))

  const productMap = new Map<string, { productName: string; quantitySold: number; totalRevenueCentavos: number }>()

  for (const item of relevantItems) {
    const existing = productMap.get(item.productId)
    if (existing) {
      existing.quantitySold += item.quantity
      existing.totalRevenueCentavos += item.lineTotalCentavos
    } else {
      productMap.set(item.productId, {
        productName: item.productName,
        quantitySold: item.quantity,
        totalRevenueCentavos: item.lineTotalCentavos,
      })
    }
  }

  const results: TopProduct[] = Array.from(productMap.entries()).map(([productId, data]) => ({
    productId,
    ...data,
  }))

  return results.sort((a, b) => b.quantitySold - a.quantitySold).slice(0, limit)
}

export async function getCategoryRevenueBreakdown(
  start: number,
  end: number,
): Promise<CategoryRevenue[]> {
  const db = await getDb()
  const [sales, allItems, allCategories, allProducts] = await Promise.all([
    db.sales.toArray(),
    db.saleItems.toArray(),
    db.categories.toArray(),
    db.products.toArray(),
  ])

  const completedSales = sales.filter((s) => s.status === 'completed' && s.createdAt >= start && s.createdAt <= end)
  const completedSaleIds = new Set(completedSales.map((s) => s.id))
  const relevantItems = allItems.filter((i) => completedSaleIds.has(i.saleId))

  const categoryNameMap = new Map<string, string>()
  for (const c of allCategories) {
    categoryNameMap.set(c.id, c.name)
  }

  const productCategoryMap = new Map<string, string | null>()
  for (const p of allProducts) {
    productCategoryMap.set(p.id, p.categoryId)
  }

  const catAgg = new Map<string, { name: string; revenue: number; qty: number }>()
  let totalRevenue = 0

  for (const item of relevantItems) {
    const catId = productCategoryMap.get(item.productId) || 'uncategorized'
    const catName = catId === 'uncategorized' ? 'Uncategorized' : (categoryNameMap.get(catId) || 'Uncategorized')
    totalRevenue += item.lineTotalCentavos

    const existing = catAgg.get(catId)
    if (existing) {
      existing.revenue += item.lineTotalCentavos
      existing.qty += item.quantity
    } else {
      catAgg.set(catId, {
        name: catName,
        revenue: item.lineTotalCentavos,
        qty: item.quantity,
      })
    }
  }

  const results: CategoryRevenue[] = []
  for (const [id, data] of catAgg.entries()) {
    results.push({
      categoryId: id === 'uncategorized' ? null : id,
      categoryName: data.name,
      totalRevenueCentavos: data.revenue,
      quantitySold: data.qty,
      percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 100) : 0,
    })
  }

  return results.sort((a, b) => b.totalRevenueCentavos - a.totalRevenueCentavos)
}

export function formatSalesToCsv(sales: Sale[]): string {
  const headers = ['Receipt No', 'Date', 'Time', 'Status', 'Items Count', 'Total (PHP)', 'Cash Received (PHP)', 'Change (PHP)', 'Void Reason']
  const rows = sales.map((s) => {
    const date = new Date(s.createdAt)
    const dateStr = date.toLocaleDateString('en-PH')
    const timeStr = date.toLocaleTimeString('en-PH')
    const totalPhp = (s.totalCentavos / 100).toFixed(2)
    const cashPhp = (s.cashReceivedCentavos / 100).toFixed(2)
    const changePhp = (s.changeCentavos / 100).toFixed(2)
    const voidReason = s.voidReason ? `"${s.voidReason.replace(/"/g, '""')}"` : ''
    return [s.receiptNo, dateStr, timeStr, s.status, s.itemCount, totalPhp, cashPhp, changePhp, voidReason].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}
