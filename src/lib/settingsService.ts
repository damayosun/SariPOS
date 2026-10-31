import { getDb } from './db'
import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'singleton',
  storeName: 'My Sari-Sari Store',
  tagline: 'Sari-Sari Store & General Merchandise',
  address: '',
  contactNumber: '',
  permitNumber: '',
  footerNote: 'Salamat sa inyong pagbili! Balik po kayo muli.',
  receiptPrefix: 'R',
  paperWidth: '58mm',
  lowStockThreshold: 10,
  lastReceiptSeq: 0,
  lastBackupAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb()
  const existing = await db.settings.get('singleton')
  if (existing) {
    // Fill in default values if not present
    return {
      ...DEFAULT_SETTINGS,
      ...existing,
    }
  }
  const now = Date.now()
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    createdAt: now,
    updatedAt: now,
  }
  await db.settings.put(settings)
  return settings
}

export async function updateStoreName(name: string): Promise<Settings> {
  return updateSettings({ storeName: name })
}

export async function updateSettings(patch: {
  storeName?: string
  tagline?: string | null
  address?: string | null
  contactNumber?: string | null
  permitNumber?: string | null
  footerNote?: string | null
  receiptPrefix?: string | null
  paperWidth?: '58mm' | '80mm'
  lowStockThreshold?: number
}): Promise<Settings> {
  const settings = await getSettings()
  const updated: Settings = { ...settings, updatedAt: Date.now() }

  if (patch.storeName !== undefined) {
    const trimmed = patch.storeName.trim()
    if (trimmed.length === 0) throw new Error('Store name is required.')
    if (trimmed.length > 80) throw new Error('Store name is too long (max 80 characters).')
    updated.storeName = trimmed
  }

  if (patch.tagline !== undefined) {
    const trimmed = patch.tagline?.trim() || null
    if (trimmed && trimmed.length > 100) throw new Error('Tagline is too long (max 100 characters).')
    updated.tagline = trimmed
  }

  if (patch.address !== undefined) {
    const trimmed = patch.address?.trim() || null
    if (trimmed && trimmed.length > 200) throw new Error('Address is too long (max 200 characters).')
    updated.address = trimmed
  }

  if (patch.contactNumber !== undefined) {
    const trimmed = patch.contactNumber?.trim() || null
    if (trimmed && trimmed.length > 50) throw new Error('Contact number is too long (max 50 characters).')
    updated.contactNumber = trimmed
  }

  if (patch.permitNumber !== undefined) {
    const trimmed = patch.permitNumber?.trim() || null
    if (trimmed && trimmed.length > 60) throw new Error('Permit/TIN is too long (max 60 characters).')
    updated.permitNumber = trimmed
  }

  if (patch.footerNote !== undefined) {
    const trimmed = patch.footerNote?.trim() || null
    if (trimmed && trimmed.length > 200) throw new Error('Footer message is too long (max 200 characters).')
    updated.footerNote = trimmed
  }

  if (patch.receiptPrefix !== undefined) {
    let p = patch.receiptPrefix?.trim().toUpperCase() || 'R'
    p = p.replace(/[^A-Z0-9]/g, '')
    if (p.length === 0) p = 'R'
    if (p.length > 8) throw new Error('Receipt prefix is too long (max 8 letters/digits).')
    updated.receiptPrefix = p
  }

  if (patch.paperWidth !== undefined) {
    updated.paperWidth = patch.paperWidth === '80mm' ? '80mm' : '58mm'
  }

  if (patch.lowStockThreshold !== undefined) {
    const val = Math.floor(patch.lowStockThreshold)
    if (!Number.isFinite(val) || val <= 0) throw new Error('Low stock threshold must be at least 1.')
    if (val > 9999) throw new Error('Low stock threshold is too large.')
    updated.lowStockThreshold = val
  }

  const db = await getDb()
  await db.settings.put(updated)
  return updated
}

export async function markBackupDone(): Promise<void> {
  const db = await getDb()
  const settings = await getSettings()
  await db.settings.put({ ...settings, lastBackupAt: Date.now(), updatedAt: Date.now() })
}
