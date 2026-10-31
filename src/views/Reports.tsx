import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  Calendar,
  AlertCircle,
  Printer,
  Flame,
  PieChart,
  X,
  FileSpreadsheet,
} from 'lucide-react'
import {
  getDailyReportRange,
  getTopSellingProducts,
  getCategoryRevenueBreakdown,
  getSalesByDateRange,
  formatSalesToCsv,
  type DailyReport,
  type TopProduct,
  type CategoryRevenue,
} from '../lib/reportsService'
import { formatMoney } from '../lib/money'
import { getSettings } from '../lib/settingsService'
import type { Settings } from '../lib/types'

export function Reports() {
  const [reports, setReports] = useState<DailyReport[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [categories, setCategories] = useState<CategoryRevenue[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rangePreset, setRangePreset] = useState<'today' | '7days' | '30days'>('7days')
  const [showZReading, setShowZReading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const getDateBoundaries = useCallback(() => {
    const now = new Date()
    let start: Date
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    if (rangePreset === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    } else if (rangePreset === '7days') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0)
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0)
    }
    return { start, end }
  }, [rangePreset])

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const { start, end } = getDateBoundaries()

      const [dailyData, topData, catData, st] = await Promise.all([
        getDailyReportRange(start, end),
        getTopSellingProducts(start.getTime(), end.getTime(), 10),
        getCategoryRevenueBreakdown(start.getTime(), end.getTime()),
        getSettings().catch(() => null),
      ])

      setReports([...dailyData].reverse())
      setTopProducts(topData)
      setCategories(catData)
      setSettings(st)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate reports.')
    } finally {
      setLoading(false)
    }
  }, [getDateBoundaries])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const totals = reports.reduce(
    (acc, r) => {
      acc.gross += r.grossSales
      acc.voided += r.voidedSales
      acc.completedCount += r.completedCount
      acc.voidedCount += r.voidedCount
      acc.allCount += r.transactionCount
      return acc
    },
    { gross: 0, voided: 0, completedCount: 0, voidedCount: 0, allCount: 0 },
  )

  const handleExportCsv = async () => {
    try {
      setExporting(true)
      const { start, end } = getDateBoundaries()
      const sales = await getSalesByDateRange(start.getTime(), end.getTime())
      const csvString = formatSalesToCsv(sales)
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const d = new Date()
      const ymd = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
      a.href = url
      a.download = `saripos-sales-${rangePreset}-${ymd}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to export CSV.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <h1>Sales Reports &amp; Analytics</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="category-chips">
              <button
                className={`chip ${rangePreset === 'today' ? 'active' : ''}`}
                onClick={() => setRangePreset('today')}
              >
                Today
              </button>
              <button
                className={`chip ${rangePreset === '7days' ? 'active' : ''}`}
                onClick={() => setRangePreset('7days')}
              >
                Last 7 Days
              </button>
              <button
                className={`chip ${rangePreset === '30days' ? 'active' : ''}`}
                onClick={() => setRangePreset('30days')}
              >
                Last 30 Days
              </button>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportCsv}
              disabled={exporting}
              title="Download CSV spreadsheet"
            >
              <FileSpreadsheet size={14} /> Export CSV
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowZReading(true)}
              title="Print Z-Reading End of Day Slip"
            >
              <Printer size={14} /> Print Summary Slip
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        {/* 4 Summary Cards */}
        <div className="card-grid">
          <div className="stat-card">
            <span className="stat-label">Net Sales (Completed)</span>
            <span className="stat-value" style={{ color: 'var(--primary)' }}>
              {formatMoney(totals.gross)}
            </span>
            <span className="stat-sub">
              From {totals.completedCount} completed {totals.completedCount === 1 ? 'sale' : 'sales'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Voided Amount</span>
            <span
              className="stat-value"
              style={{ color: totals.voided > 0 ? 'var(--error)' : 'var(--text-muted)' }}
            >
              {formatMoney(totals.voided)}
            </span>
            <span className="stat-sub">
              {totals.voidedCount} voided {totals.voidedCount === 1 ? 'transaction' : 'transactions'}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Average Order Value</span>
            <span className="stat-value">
              {totals.completedCount > 0
                ? formatMoney(Math.round(totals.gross / totals.completedCount))
                : '₱0.00'}
            </span>
            <span className="stat-sub">Per completed customer transaction</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Transactions</span>
            <span className="stat-value">{totals.allCount}</span>
            <span className="stat-sub">
              {totals.completedCount} valid · {totals.voidedCount} voided
            </span>
          </div>
        </div>

        {/* 2-Column Section: Top Selling Products (Item 1) & Category Breakdown (Item 2) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Item 1: Top-Selling Products */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Flame size={20} style={{ color: '#F97316' }} />
                <h3>Top-Selling Products</h3>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top {topProducts.length}</span>
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner" /> Loading rankings…
              </div>
            ) : topProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <p>No completed sales in this date range.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Product</th>
                      <th className="t-num">Qty Sold</th>
                      <th className="t-num">Total Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, idx) => (
                      <tr key={p.productId}>
                        <td style={{ fontWeight: 700, color: idx < 3 ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.productName}</td>
                        <td className="t-num" style={{ fontWeight: 700 }}>
                          {p.quantitySold}
                        </td>
                        <td className="t-num" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {formatMoney(p.totalRevenueCentavos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Item 2: Category Sales Breakdown */}
          <div className="section-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieChart size={20} style={{ color: 'var(--primary)' }} />
                <h3>Sales by Category</h3>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Revenue Share</span>
            </div>

            {loading ? (
              <div className="loading">
                <div className="spinner" /> Loading category data…
              </div>
            ) : categories.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 12px' }}>
                <p>No category sales data for this period.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {categories.map((c) => (
                  <div key={c.categoryName} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ fontWeight: 600 }}>{c.categoryName}</span>
                      <span style={{ fontWeight: 700 }}>
                        {formatMoney(c.totalRevenueCentavos)}{' '}
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                          ({c.percentage}%)
                        </span>
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div
                      style={{
                        width: '100%',
                        height: 8,
                        background: 'var(--border)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(c.percentage, 100)}%`,
                          height: '100%',
                          background: 'var(--primary)',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                      {c.quantitySold} units sold
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Daily Breakdown Table */}
        <div className="section-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={20} style={{ color: 'var(--primary)' }} />
            <h3>Daily Sales Breakdown</h3>
          </div>

          <div className="table-wrap">
            {loading ? (
              <div className="loading">
                <div className="spinner" /> Calculating daily summaries…
              </div>
            ) : reports.length === 0 ? (
              <div className="empty-state">
                <BarChart3 size={48} />
                <h3>No data for this date range</h3>
                <p>Complete checkouts to see daily trends and sales totals.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="t-num">Completed Sales</th>
                    <th className="t-num">Completed Count</th>
                    <th className="t-num">Voided Sales</th>
                    <th className="t-num">Voided Count</th>
                    <th className="t-num">Net Total</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.date}>
                      <td style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                          {r.date}
                        </span>
                      </td>
                      <td className="t-num" style={{ color: 'var(--success)', fontWeight: 600 }}>
                        {formatMoney(r.grossSales)}
                      </td>
                      <td className="t-num">{r.completedCount}</td>
                      <td
                        className="t-num"
                        style={{
                          color: r.voidedSales > 0 ? 'var(--error)' : 'var(--text-muted)',
                        }}
                      >
                        {formatMoney(r.voidedSales)}
                      </td>
                      <td className="t-num">{r.voidedCount}</td>
                      <td className="t-num" style={{ fontWeight: 700 }}>
                        {formatMoney(r.netSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Item 5: Printable Z-Reading / Daily Summary Slip Modal */}
      {showZReading && (
        <ZReadingModal
          rangePreset={rangePreset}
          totals={totals}
          topProducts={topProducts}
          categories={categories}
          settings={settings}
          onClose={() => setShowZReading(false)}
        />
      )}
    </div>
  )
}

function ZReadingModal({
  rangePreset,
  totals,
  topProducts,
  categories,
  settings,
  onClose,
}: {
  rangePreset: string
  totals: {
    gross: number
    voided: number
    completedCount: number
    voidedCount: number
    allCount: number
  }
  topProducts: TopProduct[]
  categories: CategoryRevenue[]
  settings: Settings | null
  onClose: () => void
}) {
  const handlePrint = () => {
    window.print()
  }

  const periodLabel =
    rangePreset === 'today'
      ? `Today (${new Date().toLocaleDateString('en-PH')})`
      : rangePreset === '7days'
        ? 'Last 7 Days'
        : 'Last 30 Days'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Sales Summary / Z-Reading</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className={`receipt ${settings?.paperWidth === '80mm' ? 'receipt-80mm' : 'receipt-58mm'}`}>
            <div className="receipt-header">
              <div className="store">{settings?.storeName || 'My Sari-Sari Store'}</div>
              {settings?.tagline && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{settings.tagline}</div>}
              {settings?.address && <div style={{ fontSize: 11, marginTop: 2 }}>{settings.address}</div>}
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                *** DAILY SALES SUMMARY ***
              </div>
            </div>

            <div className="receipt-meta">
              <span>Period: {periodLabel}</span>
              <span>{new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            <div className="receipt-items" style={{ gap: 4 }}>
              <div className="receipt-line">
                <span>Completed Orders:</span>
                <span style={{ fontWeight: 700 }}>{totals.completedCount}</span>
              </div>
              <div className="receipt-line">
                <span>Gross Completed Sales:</span>
                <span style={{ fontWeight: 700 }}>{formatMoney(totals.gross)}</span>
              </div>
              <div className="receipt-line">
                <span>Voided / Reversals ({totals.voidedCount}):</span>
                <span style={{ color: totals.voided > 0 ? 'var(--error)' : 'inherit' }}>
                  {formatMoney(totals.voided)}
                </span>
              </div>
              <div className="receipt-total" style={{ borderTop: '1px dashed var(--border)', paddingTop: 4 }}>
                <span>NET TOTAL SALES:</span>
                <span>{formatMoney(totals.gross)}</span>
              </div>
            </div>

            {/* Category Summary in Slip */}
            {categories.length > 0 && (
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>CATEGORY SALES:</div>
                {categories.slice(0, 5).map((c) => (
                  <div key={c.categoryName} className="receipt-line" style={{ fontSize: 11 }}>
                    <span className="ri-name">{c.categoryName} ({c.percentage}%)</span>
                    <span className="ri-total">{formatMoney(c.totalRevenueCentavos)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top Items in Slip */}
            {topProducts.length > 0 && (
              <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>TOP PRODUCTS:</div>
                {topProducts.slice(0, 5).map((p, i) => (
                  <div key={p.productId} className="receipt-line" style={{ fontSize: 11 }}>
                    <span className="ri-name">{i + 1}. {p.productName}</span>
                    <span className="ri-qty">{p.quantitySold}x</span>
                    <span className="ri-total">{formatMoney(p.totalRevenueCentavos)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', paddingTop: 8, borderTop: '1px dashed var(--border)', marginTop: 4 }}>
              Report Generated by SariPOS
              <div style={{ marginTop: 12, borderTop: '1px solid #ccc', paddingTop: 4, width: '80%', margin: '12px auto 0' }}>
                Cashier / Owner Signature
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print Slip
          </button>
        </div>
      </div>
    </div>
  )
}
