import Dexie, { type Transaction } from 'dexie'
import type {
  Category,
  Product,
  Sale,
  SaleItem,
  SchemaMeta,
  Settings,
  StockMovement,
} from './types'

export const SCHEMA_VERSION = 1
export const DB_NAME = 'saripos'

export class SariPOSDB extends Dexie {
  products!: Dexie.Table<Product, string>
  categories!: Dexie.Table<Category, string>
  sales!: Dexie.Table<Sale, string>
  saleItems!: Dexie.Table<SaleItem, string>
  stockMovements!: Dexie.Table<StockMovement, string>
  settings!: Dexie.Table<Settings, string>
  schemaMeta!: Dexie.Table<SchemaMeta, string>

  constructor() {
    super(DB_NAME)

    this.version(SCHEMA_VERSION).stores({
      products: 'id, name, categoryId, active, sku',
      categories: 'id, name',
      sales: 'id, receiptNo, status, createdAt',
      saleItems: 'id, saleId, productId',
      stockMovements: 'id, productId, type, saleId, createdAt',
      settings: 'id',
      schemaMeta: 'id',
    })
  }
}

export async function getDb(): Promise<SariPOSDB> {
  const db = new SariPOSDB()
  await db.open()
  return db
}

export async function ensureSchemaMeta(db: SariPOSDB, tx?: Transaction): Promise<void> {
  const table = tx ? tx.table('schemaMeta') : db.schemaMeta
  const existing = await table.get('singleton')
  if (!existing) {
    await table.put({
      id: 'singleton',
      schemaVersion: SCHEMA_VERSION,
      createdAt: Date.now(),
    })
  }
}

export async function ensureSettings(db: SariPOSDB, tx?: Transaction): Promise<Settings> {
  const table = tx ? tx.table('settings') : db.settings
  const existing = await table.get('singleton')
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
  await table.put(settings)
  return settings
}
