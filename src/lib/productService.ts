import { getDb, type SariPOSDB } from './db'
import { generateId, clampNonNegativeInt } from './id'
import { toCentavos } from './money'
import type { Category, Product } from './types'

export function validateProductName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Product name is required.'
  if (trimmed.length > 120) return 'Product name is too long (max 120 characters).'
  return null
}

export function validatePricePeso(pricePeso: number): string | null {
  if (!Number.isFinite(pricePeso) || pricePeso < 0) return 'Price must be a positive number.'
  if (pricePeso > 9_999_999) return 'Price is too large.'
  return null
}

export function validateStock(stock: number): string | null {
  if (!Number.isFinite(stock) || stock < 0) return 'Stock cannot be negative.'
  if (!Number.isInteger(stock)) return 'Stock must be a whole number.'
  if (stock > 9_999_999) return 'Stock is too large.'
  return null
}

export async function createProduct(input: {
  name: string
  categoryId?: string | null
  pricePeso: number
  stock?: number
  sku?: string | null
}): Promise<Product> {
  const nameErr = validateProductName(input.name)
  if (nameErr) throw new Error(nameErr)
  const priceErr = validatePricePeso(input.pricePeso)
  if (priceErr) throw new Error(priceErr)
  const stock = input.stock ?? 0
  const stockErr = validateStock(stock)
  if (stockErr) throw new Error(stockErr)

  const db = await getDb()
  const now = Date.now()
  const product: Product = {
    id: generateId(),
    name: input.name.trim(),
    categoryId: input.categoryId ?? null,
    priceCentavos: toCentavos(input.pricePeso),
    stock: clampNonNegativeInt(stock),
    sku: input.sku?.trim() || null,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  await db.products.add(product)
  return product
}

export async function updateProduct(
  id: string,
  patch: {
    name?: string
    categoryId?: string | null
    pricePeso?: number
    sku?: string | null
    active?: boolean
  },
): Promise<Product> {
  const db = await getDb()
  const existing = await db.products.get(id)
  if (!existing) throw new Error('Product not found.')

  const updates: Partial<Product> = { updatedAt: Date.now() }

  if (patch.name !== undefined) {
    const nameErr = validateProductName(patch.name)
    if (nameErr) throw new Error(nameErr)
    updates.name = patch.name.trim()
  }
  if (patch.categoryId !== undefined) {
    updates.categoryId = patch.categoryId
  }
  if (patch.pricePeso !== undefined) {
    const priceErr = validatePricePeso(patch.pricePeso)
    if (priceErr) throw new Error(priceErr)
    updates.priceCentavos = toCentavos(patch.pricePeso)
  }
  if (patch.sku !== undefined) {
    updates.sku = patch.sku?.trim() || null
  }
  if (patch.active !== undefined) {
    updates.active = patch.active
  }

  await db.products.update(id, updates)
  const updated = await db.products.get(id)
  if (!updated) throw new Error('Product update failed.')
  return updated
}

export async function deactivateProduct(id: string): Promise<void> {
  const db = await getDb()
  await db.products.update(id, { active: false, updatedAt: Date.now() })
}

export async function activateProduct(id: string): Promise<void> {
  const db = await getDb()
  await db.products.update(id, { active: true, updatedAt: Date.now() })
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const db = await getDb()
  return db.products.get(id)
}

export async function getAllProducts(): Promise<Product[]> {
  const db = await getDb()
  return db.products.orderBy('name').toArray()
}

export async function searchProducts(query: string, categoryId?: string | null): Promise<Product[]> {
  const db = await getDb()
  let collection = db.products.orderBy('name')
  const all = await collection.toArray()
  const q = query.trim().toLowerCase()
  return all.filter((p) => {
    if (q) {
      const matchesName = p.name.toLowerCase().includes(q)
      const matchesSku = p.sku ? p.sku.toLowerCase().includes(q) : false
      if (!matchesName && !matchesSku) return false
    }
    if (categoryId !== undefined && categoryId !== null) {
      if (p.categoryId !== categoryId) return false
    }
    return true
  })
}

export async function createCategory(name: string): Promise<Category> {
  const trimmed = name.trim()
  if (trimmed.length === 0) throw new Error('Category name is required.')
  if (trimmed.length > 60) throw new Error('Category name is too long (max 60 characters).')
  const db = await getDb()
  const now = Date.now()
  const category: Category = {
    id: generateId(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
  }
  await db.categories.add(category)
  return category
}

export async function getAllCategories(): Promise<Category[]> {
  const db = await getDb()
  return db.categories.orderBy('name').toArray()
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDb()
  await db.transaction('rw', db.categories, db.products, async () => {
    await db.products.where('categoryId').equals(id).modify({ categoryId: null })
    await db.categories.delete(id)
  })
}

export async function searchCategories(query: string): Promise<Category[]> {
  const db = await getDb()
  const all = await db.categories.orderBy('name').toArray()
  const q = query.trim().toLowerCase()
  if (!q) return all
  return all.filter((c) => c.name.toLowerCase().includes(q))
}

export { SariPOSDB }
export type { SariPOSDB as SariPOSDBType }
