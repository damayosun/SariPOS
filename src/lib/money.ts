export const PHP_CURRENCY = 'PHP'

export function formatMoney(centavos: number): string {
  const rounded = Math.round(centavos)
  const pesos = Math.floor(rounded / 100)
  const cents = Math.abs(rounded % 100)
  return `₱${pesos.toLocaleString('en-PH')}.${cents.toString().padStart(2, '0')}`
}

export function formatMoneyPlain(centavos: number): string {
  const rounded = Math.round(centavos)
  const pesos = Math.floor(rounded / 100)
  const cents = Math.abs(rounded % 100)
  return `${pesos}.${cents.toString().padStart(2, '0')}`
}

export function toCentavos(pesos: number): number {
  if (!Number.isFinite(pesos) || pesos < 0) return NaN
  return Math.round(pesos * 100)
}

export function calcLineTotal(priceCentavos: number, quantity: number): number {
  return Math.round(priceCentavos * quantity)
}

export function calcChange(cashReceivedCentavos: number, totalCentavos: number): number {
  return Math.round(cashReceivedCentavos - totalCentavos)
}

export function isCashSufficient(cashReceivedCentavos: number, totalCentavos: number): boolean {
  return cashReceivedCentavos >= totalCentavos
}
