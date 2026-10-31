import { describe, it, expect } from 'vitest'
import {
  formatMoney,
  formatMoneyPlain,
  toCentavos,
  calcLineTotal,
  calcChange,
  isCashSufficient,
} from '../lib/money'

describe('Money and Centavo Calculations', () => {
  it('formats centavos into Philippine Peso format correctly', () => {
    expect(formatMoney(0)).toBe('₱0.00')
    expect(formatMoney(1050)).toBe('₱10.50')
    expect(formatMoney(100000)).toBe('₱1,000.00')
    expect(formatMoney(75)).toBe('₱0.75')
  })

  it('formats centavos plain without currency symbol', () => {
    expect(formatMoneyPlain(1250)).toBe('12.50')
    expect(formatMoneyPlain(5)).toBe('0.05')
  })

  it('converts pesos to integer centavos accurately without floating point flaws', () => {
    expect(toCentavos(10.5)).toBe(1050)
    expect(toCentavos(19.99)).toBe(1999)
    expect(toCentavos(0)).toBe(0)
    expect(Number.isNaN(toCentavos(-5))).toBe(true)
  })

  it('calculates line total accurately', () => {
    expect(calcLineTotal(2500, 3)).toBe(7500)
    expect(calcLineTotal(150, 4)).toBe(600)
    expect(calcLineTotal(999, 1)).toBe(999)
  })

  it('calculates cash change and verifies sufficiency', () => {
    // Total is ₱75.00 (7500 centavos), customer pays ₱100.00 (10000 centavos)
    expect(isCashSufficient(10000, 7500)).toBe(true)
    expect(calcChange(10000, 7500)).toBe(2500) // Change ₱25.00

    // Exact cash
    expect(isCashSufficient(7500, 7500)).toBe(true)
    expect(calcChange(7500, 7500)).toBe(0)

    // Insufficient cash
    expect(isCashSufficient(5000, 7500)).toBe(false)
    expect(calcChange(5000, 7500)).toBe(-2500)
  })
})
