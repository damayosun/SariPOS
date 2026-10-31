import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { getDb } from '../lib/db'
import { createProduct } from '../lib/productService'
import { exportBackup, restoreBackup, validateBackup } from '../lib/backupService'
import { getSettings } from '../lib/settingsService'

describe('Backup and Restore', () => {
  beforeEach(async () => {
    const db = await getDb()
    await Promise.all([
      db.products.clear(),
      db.categories.clear(),
      db.sales.clear(),
      db.saleItems.clear(),
      db.stockMovements.clear(),
      db.settings.clear(),
      db.schemaMeta.clear(),
    ])
    await getSettings()
  })

  it('exports a valid JSON backup with all necessary tables', async () => {
    await createProduct({
      name: 'Tang Orange 25g',
      pricePeso: 22.0,
      stock: 15,
    })

    const backup = await exportBackup()
    expect(backup.schemaVersion).toBe(1)
    expect(backup.products).toHaveLength(1)
    expect(backup.products[0].name).toBe('Tang Orange 25g')
    expect(backup.settings.storeName).toBe('My Sari-Sari Store')

    // Validates against Zod schema
    const validated = validateBackup(backup)
    expect(validated.products).toHaveLength(1)
  })

  it('restores backup atomically into IndexedDB', async () => {
    const backupData = {
      schemaVersion: 1,
      exportedAt: Date.now(),
      products: [
        {
          id: 'prod-101',
          name: 'Nescafe Classic 50g',
          categoryId: null,
          priceCentavos: 4500,
          stock: 20,
          sku: 'NES-01',
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      categories: [
        {
          id: 'cat-coffee',
          name: 'Coffee & Drinks',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ],
      sales: [],
      saleItems: [],
      stockMovements: [],
      settings: {
        id: 'singleton',
        storeName: "Nanay Coring's Store",
        lastReceiptSeq: 15,
        lastBackupAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      schemaMeta: {
        id: 'singleton',
        schemaVersion: 1,
        createdAt: Date.now(),
      },
    }

    const res = await restoreBackup(backupData)
    expect(res.success).toBe(true)
    expect(res.counts.products).toBe(1)
    expect(res.counts.categories).toBe(1)

    const db = await getDb()
    const p = await db.products.get('prod-101')
    expect(p?.name).toBe('Nescafe Classic 50g')
    const s = await db.settings.get('singleton')
    expect(s?.storeName).toBe("Nanay Coring's Store")
  })

  it('rejects invalid backup schema and leaves existing database intact', async () => {
    // Seed database first
    await createProduct({
      name: 'Existing Product Before Bad Restore',
      pricePeso: 10.0,
      stock: 10,
    })

    const invalidBackup = {
      schemaVersion: 1,
      // Missing required tables: products, sales, settings etc.
      exportedAt: 'not-a-timestamp',
    }

    const res = await restoreBackup(invalidBackup)
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()

    // Ensure database was NOT cleared or damaged
    const db = await getDb()
    const products = await db.products.toArray()
    expect(products).toHaveLength(1)
    expect(products[0].name).toBe('Existing Product Before Bad Restore')
  })
})
