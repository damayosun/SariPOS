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
