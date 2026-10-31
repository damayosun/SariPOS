import { z } from 'zod'
import { getDb } from './db'
import { SCHEMA_VERSION } from './db'
import { markBackupDone } from './settingsService'
import type {
  Category,
  Product,
  Sale,
  SaleItem,
  SchemaMeta,
  Settings,
  StockMovement,
} from './types'

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  categoryId: z.string().nullable(),
  priceCentavos: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(),
  sku: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const saleSchema = z.object({
  id: z.string().min(1),
  receiptNo: z.string().min(1),
  status: z.enum(['completed', 'voided']),
  totalCentavos: z.number().int().nonnegative(),
  cashReceivedCentavos: z.number().int().nonnegative(),
  changeCentavos: z.number().int(),
  itemCount: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  voidedAt: z.number().int().nullable(),
  voidReason: z.string().nullable(),
})

const saleItemSchema = z.object({
  id: z.string().min(1),
  saleId: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  priceCentavos: z.number().int().nonnegative(),
  costCentavos: z.number().int().nullable(),
  quantity: z.number().int().positive(),
  lineTotalCentavos: z.number().int().nonnegative(),
})

const stockMovementSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  type: z.enum(['sale', 'void', 'stockin', 'adjustment']),
  quantityChange: z.number().int(),
  reason: z.string().min(1).max(300),
  saleId: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
})

const settingsSchema = z.object({
  id: z.literal('singleton'),
  storeName: z.string().min(1).max(80),
  lastReceiptSeq: z.number().int().nonnegative(),
  lastBackupAt: z.number().int().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
})

const schemaMetaSchema = z.object({
  id: z.literal('singleton'),
  schemaVersion: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(),
})

export const backupSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number().int().nonnegative(),
  products: z.array(productSchema),
  categories: z.array(categorySchema),
  sales: z.array(saleSchema),
  saleItems: z.array(saleItemSchema),
  stockMovements: z.array(stockMovementSchema),
  settings: settingsSchema,
  schemaMeta: schemaMetaSchema,
})

export type BackupData = z.infer<typeof backupSchema>

export async function exportBackup(): Promise<BackupData> {
  const db = await getDb()
  const [products, categories, sales, saleItems, stockMovements, settings, schemaMeta] = await Promise.all([
    db.products.toArray(),
    db.categories.toArray(),
    db.sales.toArray(),
    db.saleItems.toArray(),
    db.stockMovements.toArray(),
    db.settings.toArray(),
    db.schemaMeta.toArray(),
  ])
  const meta = schemaMeta[0] ?? {
    id: 'singleton' as const,
    schemaVersion: SCHEMA_VERSION,
    createdAt: Date.now(),
  }
  const settingsRecord = settings[0] ?? {
    id: 'singleton' as const,
    storeName: 'My Sari-Sari Store',
    lastReceiptSeq: 0,
    lastBackupAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    products: products as Product[],
    categories: categories as Category[],
    sales: sales as Sale[],
    saleItems: saleItems as SaleItem[],
    stockMovements: stockMovements as StockMovement[],
    settings: settingsRecord as Settings,
    schemaMeta: meta as SchemaMeta,
  }
}

export function validateBackup(data: unknown): BackupData {
  return backupSchema.parse(data)
}

export type RestoreResult = {
  success: boolean
  counts: {
    products: number
    categories: number
    sales: number
    saleItems: number
    stockMovements: number
  }
  error?: string
}

export async function restoreBackup(data: unknown): Promise<RestoreResult> {
  let backup: BackupData
  try {
    backup = validateBackup(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return {
        success: false,
        counts: { products: 0, categories: 0, sales: 0, saleItems: 0, stockMovements: 0 },
        error: e.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; '),
      }
    }
    return {
      success: false,
      counts: { products: 0, categories: 0, sales: 0, saleItems: 0, stockMovements: 0 },
      error: 'Backup file is not valid JSON or has an invalid structure.',
    }
  }

  const db = await getDb()

  await db.transaction(
    'rw',
    db.products,
    db.categories,
    db.sales,
    db.saleItems,
    db.stockMovements,
    db.settings,
    db.schemaMeta,
    async () => {
      await Promise.all([
        db.products.clear(),
        db.categories.clear(),
        db.sales.clear(),
        db.saleItems.clear(),
        db.stockMovements.clear(),
        db.settings.clear(),
        db.schemaMeta.clear(),
      ])

      await db.categories.bulkPut(backup.categories)
      await db.products.bulkPut(backup.products)
      await db.sales.bulkPut(backup.sales)
      await db.saleItems.bulkPut(backup.saleItems)
      await db.stockMovements.bulkPut(backup.stockMovements)
      await db.settings.put(backup.settings)
      await db.schemaMeta.put(backup.schemaMeta)
    },
  )

  await markBackupDone()

  return {
    success: true,
    counts: {
      products: backup.products.length,
      categories: backup.categories.length,
      sales: backup.sales.length,
      saleItems: backup.saleItems.length,
      stockMovements: backup.stockMovements.length,
    },
  }
}
