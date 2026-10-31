import { getDb } from './db'
import type { Settings } from './types'

export async function getSettings(): Promise<Settings> {
  const db = await getDb()
  const existing = await db.settings.get('singleton')
  if (existing) return existing
  const now = Date.now()
  const settings: Settings = {
    id: 'singleton',
    storeName: 'My Sari-Sari Store',
    lastReceiptSeq: 0,
    lastBackupAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.settings.put(settings)
  return settings
}

export async function updateStoreName(name: string): Promise<Settings> {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Store name is required.')
  if (trimmed.length > 80) throw new Error('Store name is too long (max 80 characters).')
  const db = await getDb()
  const settings = await getSettings()
  const updated = { ...settings, storeName: trimmed, updatedAt: Date.now() }
  await db.settings.put(updated)
  return updated
}

export async function markBackupDone(): Promise<void> {
  const db = await getDb()
  const settings = await getSettings()
  await db.settings.put({ ...settings, lastBackupAt: Date.now(), updatedAt: Date.now() })
}
