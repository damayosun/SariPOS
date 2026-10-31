export type Category = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type Product = {
  id: string
  name: string
  categoryId: string | null
  priceCentavos: number
  stock: number
  sku: string | null
  active: boolean
  createdAt: number
  updatedAt: number
}

export type SaleStatus = 'completed' | 'voided'

export type Sale = {
  id: string
  receiptNo: string
  status: SaleStatus
  totalCentavos: number
  cashReceivedCentavos: number
  changeCentavos: number
  itemCount: number
  createdAt: number
  voidedAt: number | null
  voidReason: string | null
}

export type SaleItem = {
  id: string
  saleId: string
  productId: string
  productName: string
  priceCentavos: number
  costCentavos: number | null
  quantity: number
  lineTotalCentavos: number
}

export type MovementType = 'sale' | 'void' | 'stockin' | 'adjustment'

export type StockMovement = {
  id: string
  productId: string
  productName: string
  type: MovementType
  quantityChange: number
  reason: string
  saleId: string | null
  createdAt: number
}

export type Settings = {
  id: 'singleton' | string
  storeName: string
  tagline?: string | null
  address?: string | null
  contactNumber?: string | null
  permitNumber?: string | null
  footerNote?: string | null
  receiptPrefix?: string | null
  paperWidth?: '58mm' | '80mm'
  lowStockThreshold?: number
  lastReceiptSeq: number
  lastBackupAt: number | null
  createdAt: number
  updatedAt: number
}

export type SchemaMeta = {
  id: 'singleton' | string
  schemaVersion: number
  createdAt: number
}
