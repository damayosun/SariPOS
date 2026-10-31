import { useEffect, useState } from 'react'
import { X, Printer, CheckCircle } from 'lucide-react'
import { getSaleItems } from '../lib/reportsService'
import { formatMoney } from '../lib/money'
import { getSettings } from '../lib/settingsService'
import type { Sale, SaleItem, Settings } from '../lib/types'
import { getDb } from '../lib/db'

export function ReceiptModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [sale, setSale] = useState<Sale | null>(null)
  const [items, setItems] = useState<SaleItem[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const db = await getDb()
      const s = await db.sales.get(saleId)
      const si = await getSaleItems(saleId)
      const st = await getSettings()
      setSale(s ?? null)
      setItems(si)
      setSettings(st)
      setLoading(false)
    })()
  }, [saleId])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sale Complete</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close receipt">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading"><div className="spinner" />Loading receipt…</div>
          ) : sale && settings ? (
            <>
              <div className="alert alert-success">
                <CheckCircle />
                <span>Sale saved successfully. Receipt #{sale.receiptNo}</span>
              </div>
              <div className={`receipt ${settings.paperWidth === '80mm' ? 'receipt-80mm' : 'receipt-58mm'}`}>
                <div className="receipt-header">
                  <div className="store">{settings.storeName}</div>
                  {settings.tagline && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{settings.tagline}</div>}
                  {settings.address && <div style={{ fontSize: 11, marginTop: 2 }}>{settings.address}</div>}
                  {settings.contactNumber && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Tel/GCash: {settings.contactNumber}
                    </div>
                  )}
                  {settings.permitNumber && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Permit/TIN: {settings.permitNumber}
                    </div>
                  )}
                </div>
                <div className="receipt-meta">
                  <span>{sale.receiptNo}</span>
                  <span>{new Date(sale.createdAt).toLocaleString('en-PH')}</span>
                </div>
                <div className="receipt-items">
                  {items.map((item) => (
                    <div key={item.id} className="receipt-line">
                      <span className="ri-name">{item.productName}</span>
                      <span className="ri-qty">{item.quantity} × {formatMoney(item.priceCentavos)}</span>
                      <span className="ri-total">{formatMoney(item.lineTotalCentavos)}</span>
                    </div>
                  ))}
                </div>
                <div className="receipt-total">
                  <span>TOTAL</span>
                  <span>{formatMoney(sale.totalCentavos)}</span>
                </div>
                <div className="receipt-line">
                  <span>Cash</span>
                  <span>{formatMoney(sale.cashReceivedCentavos)}</span>
                </div>
                <div className="receipt-line">
                  <span>Change</span>
                  <span>{formatMoney(sale.changeCentavos)}</span>
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', paddingTop: 6, borderTop: '1px dashed var(--border)', marginTop: 4 }}>
                  {settings.footerNote || 'Salamat sa inyong pagbili! Balik po kayo muli.'}
                </div>
              </div>
            </>
          ) : (
            <div className="alert alert-error">Could not load receipt.</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
