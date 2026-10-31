import { useCallback, useEffect, useState } from 'react'
import { Search, Receipt, Ban, Eye, AlertCircle, CheckCircle, Calendar, X } from 'lucide-react'
import type { Sale } from '../lib/types'
import { getAllSales } from '../lib/reportsService'
import { voidSale } from '../lib/salesService'
import { formatMoney } from '../lib/money'
import { ReceiptModal } from './ReceiptModal'

export function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'voided'>('all')
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [voidingSale, setVoidingSale] = useState<Sale | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadSales = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAllSales()
      setSales(data)
    } catch (e) {
      setFeedback({
        type: 'error',
        message: e instanceof Error ? e.message : 'Failed to load sales history.',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  const filteredSales = sales.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      if (!s.receiptNo.toLowerCase().includes(q)) return false
    }
    if (dateFilter) {
      const saleDate = new Date(s.createdAt).toISOString().slice(0, 10)
      if (saleDate !== dateFilter) return false
    }
    return true
  })

  const handleVoidComplete = () => {
    setVoidingSale(null)
    setFeedback({
      type: 'success',
      message: 'Sale voided successfully. Stock has been restored.',
    })
    loadSales()
  }

  return (
    <div className="page">
      <div className="page-content">
        <div className="page-header">
          <h1>Sales History</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {filteredSales.length} {filteredSales.length === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>

        {feedback && (
          <div className={`alert alert-${feedback.type}`}>
            {feedback.type === 'success' ? <CheckCircle /> : <AlertCircle />}
            <span>{feedback.message}</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto', padding: '2px 6px' }}
              onClick={() => setFeedback(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="section-card">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search
                size={18}
                style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }}
              />
              <input
                className="search-input"
                style={{ paddingLeft: 40 }}
                type="search"
                placeholder="Search by receipt number (e.g. R-20261031-0001)…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search by receipt number"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={18} style={{ color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter by date"
                style={{ padding: '8px 12px', width: 'auto' }}
              />
              {dateFilter && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDateFilter('')}
                  title="Clear date filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="category-chips">
            <button
              className={`chip ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Statuses
            </button>
            <button
              className={`chip ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('completed')}
            >
              Completed
            </button>
            <button
              className={`chip ${statusFilter === 'voided' ? 'active' : ''}`}
              onClick={() => setStatusFilter('voided')}
            >
              Voided
            </button>
          </div>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="loading">
              <div className="spinner" /> Loading transactions…
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="empty-state">
              <Receipt size={48} />
              <h3>No transactions found</h3>
              <p>
                {query || dateFilter || statusFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Completed sales will appear here.'}
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date & Time</th>
                  <th className="t-num">Items</th>
                  <th className="t-num">Total</th>
                  <th className="t-num">Cash</th>
                  <th className="t-num">Change</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((s) => (
                  <tr key={s.id}>
                    <td className="t-mono" style={{ fontWeight: 600 }}>
                      {s.receiptNo}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {new Date(s.createdAt).toLocaleString('en-PH')}
                    </td>
                    <td className="t-num">{s.itemCount}</td>
                    <td className="t-num" style={{ fontWeight: 700 }}>
                      {formatMoney(s.totalCentavos)}
                    </td>
                    <td className="t-num">{formatMoney(s.cashReceivedCentavos)}</td>
                    <td className="t-num">{formatMoney(s.changeCentavos)}</td>
                    <td>
                      <span className={`pill ${s.status}`}>
                        {s.status === 'completed' ? 'Completed' : 'Voided'}
                      </span>
                      {s.status === 'voided' && s.voidReason && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--error)',
                            marginTop: 2,
                            maxWidth: 160,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`Reason: ${s.voidReason}`}
                        >
                          {s.voidReason}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedSaleId(s.id)}
                        title="View receipt"
                      >
                        <Eye size={14} /> View
                      </button>
                      {s.status === 'completed' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ color: 'var(--error)' }}
                          onClick={() => setVoidingSale(s)}
                          title="Void sale and restore inventory"
                        >
                          <Ban size={14} /> Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedSaleId && (
        <ReceiptModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      )}

      {voidingSale && (
        <VoidModal
          sale={voidingSale}
          onClose={() => setVoidingSale(null)}
          onSuccess={handleVoidComplete}
        />
      )}
    </div>
  )
}

function VoidModal({
  sale,
  onClose,
  onSuccess,
}: {
  sale: Sale
  onClose: () => void
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleVoid = async () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError('A reason is required to void this sale.')
      return
    }
    if (trimmed.length > 300) {
      setError('Reason cannot exceed 300 characters.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await voidSale(sale.id, trimmed)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to void sale.')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Void Sale — {sale.receiptNo}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="alert alert-warning">
            <AlertCircle />
            <span>
              Voiding this sale will mark transaction <strong>{sale.receiptNo}</strong> as voided and
              automatically restore stock for all {sale.itemCount} items. This cannot be undone.
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
            <span style={{ color: 'var(--text-muted)' }}>Sale Total</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(sale.totalCentavos)}</span>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="void-reason">Reason for Void *</label>
            <textarea
              id="void-reason"
              className="form-textarea"
              rows={3}
              placeholder="e.g. Customer returned items, entered wrong items, or cash payment error"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
              {reason.length}/300
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={handleVoid}
            disabled={submitting || !reason.trim()}
          >
            {submitting ? 'Voiding…' : 'Confirm Void'}
          </button>
        </div>
      </div>
    </div>
  )
}
