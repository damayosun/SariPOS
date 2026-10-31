export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${ts}-${rand}`
}

let receiptCounter = 0

export function generateReceiptNo(seq: number, prefix: string = 'R'): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`
  const p = (prefix?.trim() || 'R').toUpperCase()
  return `${p}-${ymd}-${seq.toString().padStart(4, '0')}`
}

export function nextAttemptId(): string {
  receiptCounter += 1
  return `${Date.now()}-${receiptCounter}-${Math.random().toString(36).slice(2, 8)}`
}

export function clampNonNegativeInt(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.floor(value)
}
