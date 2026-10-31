import { useEffect, useState, useRef } from 'react'
import {
  Store,
  Database,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  HardDrive,
  Info,
  X,
  Receipt,
  Sparkles,
  FileText,
} from 'lucide-react'
import { getSettings, updateSettings } from '../lib/settingsService'
import { exportBackup, restoreBackup, validateBackup, type BackupData } from '../lib/backupService'
import { usePersistentStorage } from '../hooks/usePersistentStorage'
import type { Settings } from '../lib/types'

export function SettingsView({ onStoreNameChange }: { onStoreNameChange: (name: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)

  // Form states for customization
  const [storeName, setStoreName] = useState('')
  const [tagline, setTagline] = useState('')
  const [address, setAddress] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [permitNumber, setPermitNumber] = useState('')
  const [footerNote, setFooterNote] = useState('')
  const [receiptPrefix, setReceiptPrefix] = useState('R')
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm')
  const [lowStockThreshold, setLowStockThreshold] = useState('10')

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreResult, setRestoreResult] = useState<string | null>(null)
  const [showTerms, setShowTerms] = useState(false)

  const persistStatus = usePersistentStorage()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s)
        setStoreName(s.storeName || '')
        setTagline(s.tagline || '')
        setAddress(s.address || '')
        setContactNumber(s.contactNumber || '')
        setPermitNumber(s.permitNumber || '')
        setFooterNote(s.footerNote || '')
        setReceiptPrefix(s.receiptPrefix || 'R')
        setPaperWidth(s.paperWidth || '58mm')
        setLowStockThreshold(String(s.lowStockThreshold || 10))
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings.'))
  }, [])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaveSuccess(false)
    setSaving(true)
    try {
      const thresholdNum = parseInt(lowStockThreshold, 10) || 10
      const updated = await updateSettings({
        storeName,
        tagline: tagline || null,
        address: address || null,
        contactNumber: contactNumber || null,
        permitNumber: permitNumber || null,
        footerNote: footerNote || null,
        receiptPrefix: receiptPrefix || 'R',
        paperWidth,
        lowStockThreshold: thresholdNum,
      })
      setSettings(updated)
      onStoreNameChange(updated.storeName)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleExportBackup = async () => {
    setError('')
    try {
      const backup = await exportBackup()
      const jsonStr = JSON.stringify(backup, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const d = new Date()
      const ymd = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
      a.href = url
      a.download = `saripos-backup-${ymd}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const s = await getSettings()
      setSettings(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export backup.')
    }
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    setRestoreResult(null)
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('Selected file is not valid JSON.')
      }

      const validated = validateBackup(parsed)
      setPendingBackup(validated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid backup file structure.')
      setPendingBackup(null)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConfirmRestore = async () => {
    if (!pendingBackup) return
    setRestoring(true)
    setError('')
    try {
      const result = await restoreBackup(pendingBackup)
      if (!result.success) {
        throw new Error(result.error || 'Restore failed.')
      }
      setPendingBackup(null)
      setRestoreResult(
        `Successfully restored ${result.counts.products} products, ${result.counts.categories} categories, and ${result.counts.sales} sales transactions.`,
      )
      const s = await getSettings()
      setSettings(s)
      setStoreName(s.storeName || '')
      setTagline(s.tagline || '')
      setAddress(s.address || '')
      setContactNumber(s.contactNumber || '')
      setPermitNumber(s.permitNumber || '')
      setFooterNote(s.footerNote || '')
      setReceiptPrefix(s.receiptPrefix || 'R')
      setPaperWidth(s.paperWidth || '58mm')
      setLowStockThreshold(String(s.lowStockThreshold || 10))
      onStoreNameChange(s.storeName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="page">
      <div className="page-content" style={{ maxWidth: 1200 }}>
        <div className="page-header">
          <h1>Store Settings &amp; Customization</h1>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="alert alert-success">
            <CheckCircle />
            <span>Store profile &amp; receipt customization saved successfully!</span>
          </div>
        )}

        {restoreResult && (
          <div className="alert alert-success">
            <CheckCircle />
            <span>{restoreResult}</span>
          </div>
        )}

        {/* 2-Column Layout: Form on Left, Live Receipt Preview on Right */}
        <div className="settings-layout">
          {/* Customization Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <form onSubmit={handleSaveSettings} className="section-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Store size={20} style={{ color: 'var(--primary)' }} />
                <h3>Store Identity &amp; Receipt Setup</h3>
              </div>

              <div className="form-group">
                <label htmlFor="cfg-store-name">Store Name (Printed on receipts and header) *</label>
                <input
                  id="cfg-store-name"
                  className="form-input"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Aling Nena's Sari-Sari Store"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="cfg-tagline">Tagline / Business Subtitle</label>
                <input
                  id="cfg-tagline"
                  className="form-input"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. General Merchandise &amp; E-Loading Station"
                />
              </div>

              <div className="form-group">
                <label htmlFor="cfg-address">Store Address / Barangay</label>
                <input
                  id="cfg-address"
                  className="form-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Block 4 Lot 12, Brgy. San Jose, Antipolo City"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cfg-contact">Contact Number / GCash</label>
                  <input
                    id="cfg-contact"
                    className="form-input"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    maxLength={50}
                    placeholder="e.g. 0917-123-4567"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cfg-permit">Permit / DTI / TIN (optional)</label>
                  <input
                    id="cfg-permit"
                    className="form-input"
                    value={permitNumber}
                    onChange={(e) => setPermitNumber(e.target.value)}
                    maxLength={60}
                    placeholder="e.g. DTI-12345678 or Brgy Permit #042"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="cfg-footer">Custom Receipt Footer Message</label>
                <input
                  id="cfg-footer"
                  className="form-input"
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Salamat sa inyong pagbili! Balik po kayo muli."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cfg-prefix">Receipt Number Prefix</label>
                  <input
                    id="cfg-prefix"
                    className="form-input"
                    value={receiptPrefix}
                    onChange={(e) => setReceiptPrefix(e.target.value.toUpperCase())}
                    maxLength={8}
                    placeholder="e.g. R, OR, INV, SARI"
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Example receipt format: {receiptPrefix || 'R'}-20261031-0001
                  </span>
                </div>
                <div className="form-group">
                  <label htmlFor="cfg-paper">Receipt Paper Width</label>
                  <select
                    id="cfg-paper"
                    className="form-select"
                    value={paperWidth}
                    onChange={(e) => setPaperWidth(e.target.value as '58mm' | '80mm')}
                  >
                    <option value="58mm">58mm (Compact Mobile/Bluetooth Thermal)</option>
                    <option value="80mm">80mm (Standard Desktop Thermal / Full)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="cfg-threshold">Low-Stock Alert Threshold (Units)</label>
                <input
                  id="cfg-threshold"
                  className="form-input"
                  type="number"
                  min="1"
                  max="999"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  style={{ maxWidth: 200 }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Products with stock at or below this number show the amber &quot;Low stock&quot; warning badge.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <Sparkles size={16} />
                  {saving ? 'Saving Changes…' : 'Save Store & Receipt Settings'}
                </button>
              </div>
            </form>

            {/* Local Backup and Restore */}
            <div className="section-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={20} style={{ color: 'var(--primary)' }} />
                <h3>Local Backup &amp; Restore</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Export Store Database</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Downloads a complete JSON copy of your store&apos;s database.
                      {settings?.lastBackupAt ? (
                        <span style={{ display: 'block', marginTop: 2 }}>
                          Last backup: {new Date(settings.lastBackupAt).toLocaleString('en-PH')}
                        </span>
                      ) : (
                        <span style={{ display: 'block', marginTop: 2, color: 'var(--warning)' }}>
                          No backup exported yet.
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-secondary" onClick={handleExportBackup}>
                    <Download size={16} /> Export Backup (.json)
                  </button>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Restore from Backup</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Restore your store database from a previously exported SariPOS JSON file.
                    </div>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept=".json,application/json"
                      style={{ display: 'none' }}
                      onChange={handleFileSelected}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={16} /> Select Backup File…
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* iPad Storage Status */}
            <div className="section-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardDrive size={20} style={{ color: 'var(--primary)' }} />
                <h3>iPad Storage &amp; Persistence</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontWeight: 600 }}>Storage Status:</div>
                <span
                  className={`pill ${
                    persistStatus === 'granted'
                      ? 'ok'
                      : persistStatus === 'denied'
                        ? 'low'
                        : 'inactive'
                  }`}
                >
                  {persistStatus === 'granted'
                    ? 'Persistent (Protected from eviction)'
                    : persistStatus === 'denied'
                      ? 'Standard (May be cleared if iPad disk is full)'
                      : persistStatus === 'unsupported'
                        ? 'Standard Browser Storage'
                        : 'Checking…'}
                </span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: '150%' }}>
                SariPOS stores all products, transactions, and inventory directly in your device&apos;s
                IndexedDB. No internet connection is needed. To guard against device damage or Safari
                storage clearance, export a backup regularly to a USB drive, Files app, or iCloud.
              </p>
            </div>

            {/* Terms and Conditions of Use */}
            <div className="section-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={20} style={{ color: 'var(--primary)' }} />
                  <h3>Terms &amp; Conditions of Use</h3>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowTerms(true)}
                >
                  <FileText size={14} /> Read Full Terms
                </button>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '150%', margin: 0 }}>
                By using SariPOS, you acknowledge that all store data resides strictly on this physical iPad, that you are solely responsible for exporting regular data backups, and that this app functions as an internal retail tracking tool rather than an accredited BIR Cash Register Machine (CRM).
              </p>
            </div>
          </div>

          {/* Live Receipt Mockup on Right Side */}
          <div className="receipt-preview-sticky">
            <div className="section-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}>
                  <Receipt size={16} style={{ color: 'var(--primary)' }} />
                  <span>Live Receipt Preview</span>
                </div>
                <span className="pill ok" style={{ fontSize: 11 }}>{paperWidth}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Real-time preview of how receipts print with your customized information.
              </p>

              <div className={`receipt ${paperWidth === '80mm' ? 'receipt-80mm' : 'receipt-58mm'}`}>
                <div className="receipt-header">
                  <div className="store">{storeName || 'My Sari-Sari Store'}</div>
                  {tagline && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tagline}</div>}
                  {address && <div style={{ fontSize: 11, marginTop: 2 }}>{address}</div>}
                  {contactNumber && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Tel/GCash: {contactNumber}
                    </div>
                  )}
                  {permitNumber && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      Permit/TIN: {permitNumber}
                    </div>
                  )}
                </div>
                <div className="receipt-meta">
                  <span>{receiptPrefix || 'R'}-20261031-0001</span>
                  <span>{new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="receipt-items">
                  <div className="receipt-line">
                    <span className="ri-name">Lucky Me Pancit Canton</span>
                    <span className="ri-qty">2 × ₱18.50</span>
                    <span className="ri-total">₱37.00</span>
                  </div>
                  <div className="receipt-line">
                    <span className="ri-name">Coca-Cola 500ml</span>
                    <span className="ri-qty">1 × ₱35.00</span>
                    <span className="ri-total">₱35.00</span>
                  </div>
                </div>
                <div className="receipt-total">
                  <span>TOTAL</span>
                  <span>₱72.00</span>
                </div>
                <div className="receipt-line">
                  <span>Cash</span>
                  <span>₱100.00</span>
                </div>
                <div className="receipt-line">
                  <span>Change</span>
                  <span>₱28.00</span>
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    paddingTop: 6,
                    borderTop: '1px dashed var(--border)',
                    marginTop: 4,
                  }}
                >
                  {footerNote || 'Salamat sa inyong pagbili! Balik po kayo muli.'}
                </div>
              </div>
            </div>

            <div className="section-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}>
                <Info size={16} style={{ color: 'var(--primary)' }} />
                <span>Printer Setup Tip</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: '140%', marginTop: 6 }}>
                For Bluetooth 58mm mini thermal printers connected to your iPad, select <strong>58mm</strong> format and use Safari&apos;s system print dialog.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {pendingBackup && (
        <div className="modal-overlay" onClick={() => setPendingBackup(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Database Restore</h2>
              <button
                className="modal-close"
                onClick={() => setPendingBackup(null)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning">
                <AlertCircle />
                <span>
                  <strong>Warning:</strong> Restoring this backup will replace all current products,
                  categories, sales history, and stock records. Current records will be overwritten.
                </span>
              </div>

              <div style={{ fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontWeight: 600 }}>Backup Details:</div>
                <div>Exported Date: {new Date(pendingBackup.exportedAt).toLocaleString('en-PH')}</div>
                <div>Products: {pendingBackup.products.length}</div>
                <div>Categories: {pendingBackup.categories.length}</div>
                <div>Sales Transactions: {pendingBackup.sales.length}</div>
                <div>Stock Movement Records: {pendingBackup.stockMovements.length}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setPendingBackup(null)}
                disabled={restoring}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleConfirmRestore}
                disabled={restoring}
              >
                {restoring ? 'Restoring…' : 'Overwrite and Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms and Conditions Modal */}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </div>
  )
}

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={20} style={{ color: 'var(--primary)' }} />
            <h2>Terms and Conditions of Use</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', fontSize: 14, lineHeight: '160%' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>
            Last Updated: October 31, 2026. Please read these Terms and Conditions carefully before using the SariPOS application.
          </p>

          <h4 style={{ margin: '16px 0 6px', color: 'var(--text-h)' }}>1. Nature of the Software &amp; Local-First Architecture</h4>
          <p>
            SariPOS is a local-first web and Progressive Web App (PWA) designed to provide offline point-of-sale checkout, inventory tracking, and sales reporting for small retail sari-sari stores. All business data, transaction logs, inventory counts, and custom settings reside strictly on your physical device (via browser IndexedDB). No remote cloud database or third-party server hosts, stores, or processes your business records.
          </p>

          <h4 style={{ margin: '16px 0 6px', color: 'var(--text-h)' }}>2. User Responsibility for Data Backups &amp; Durability</h4>
          <p>
            Because SariPOS does not operate a central cloud database, <strong>you are solely responsible for maintaining backups of your store records</strong>. You agree to regularly use the built-in <em>Export Backup (.json)</em> tool in the Settings tab to download and save your database to safe external storage (such as the iPad Files app, iCloud Drive, or an external USB flash drive).
          </p>
          <p style={{ color: 'var(--text-muted)' }}>
            The software developers and hosts are not liable for data loss caused by hardware theft, water/physical damage, Safari storage cache clearance, accidental browser resets, or operating system upgrades.
          </p>

          <h4 style={{ margin: '16px 0 6px', color: 'var(--text-h)' }}>3. Tax, Legal Compliance &amp; BIR Disclaimer</h4>
          <p>
            SariPOS is an internal operations and inventory management tool. <strong>It is NOT a BIR-accredited Cash Register Machine (CRM) or Point of Sale (POS) system</strong> certified by the Philippine Bureau of Internal Revenue (BIR) under Revenue Regulations.
          </p>
          <p>
            Receipts printed or displayed by this software are store calculation and acknowledgment slips. As a retail business owner, you remain solely responsible for:
          </p>
          <ul style={{ paddingLeft: 20, margin: '6px 0' }}>
            <li>Registering your retail enterprise with the proper authorities (Barangay, DTI, LGU Mayor&apos;s Permit, and BIR).</li>
            <li>Issuing official BIR-registered printed receipts or manual sales invoices if required by your tax classification (such as BMBE or Non-VAT micro-enterprise).</li>
            <li>Accurate tax accounting, revenue reporting, and compliance with Philippine commercial laws.</li>
          </ul>

          <h4 style={{ margin: '16px 0 6px', color: 'var(--text-h)' }}>4. Cash Transactions &amp; Accuracy of Figures</h4>
          <p>
            SariPOS is built for cash-only micro-retail transactions in Philippine Pesos (PHP). All change calculations, totals, and inventory counts depend on the numbers entered by the cashier or owner. You are responsible for verifying physical bills, coins, and counted stock.
          </p>

          <h4 style={{ margin: '16px 0 6px', color: 'var(--text-h)' }}>5. Physical Device Security &amp; Access Control</h4>
          <p>
            Anyone with physical access to your unlocked iPad or device can interact with SariPOS, process sales, or adjust inventory. You agree to maintain appropriate physical and digital security, including setting an iPad passcode and utilizing Apple Guided Access (Kiosk mode) to restrict counter access.
          </p>

          <h4 style={{ margin: '16px 0 6px', color: 'var(--text-h)' }}>6. Disclaimer of Warranties (&quot;As Is&quot;)</h4>
          <p>
            SariPOS is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express, implied, or statutory, including warranties of merchantability, fitness for a particular commercial purpose, or uninterrupted, error-free operation.
          </p>

          <h4 style={{ margin: '16px 0 6px', color: 'var(--text-h)' }}>7. Limitation of Liability</h4>
          <p>
            To the maximum extent permitted by applicable law, in no event shall the authors, creators, or contributors of SariPOS be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, lost revenue, inventory discrepancy, or loss of business records arising from the use of or inability to use this software.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            I Understand and Agree
          </button>
        </div>
      </div>
    </div>
  )
}
