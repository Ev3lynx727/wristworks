export const CURRENCY_DECIMALS: Record<string, number> = {
  IDR: 0, JPY: 0, KRW: 0, VND: 0, CLP: 0, COP: 0,
  HUF: 0, ISK: 0, PKR: 0, UGX: 0, RWF: 0, MGA: 0,
  KWD: 3, BHD: 3, OMR: 3, JOD: 3, TND: 3, IQD: 3,
}

export const DEFAULT_CURRENCY_TARGETS = [
  'IDR', 'CNY', 'SGD', 'MYR', 'JPY', 'KRW',
  'THB', 'PHP', 'VND', 'INR',
  'EUR', 'GBP', 'AUD', 'USD',
]

export const DEFAULT_CURRENCY_PAIRS = [
  'USD/IDR', 'USD/EUR', 'USD/JPY', 'USD/CNY', 'USD/SGD', 'USD/MYR',
  'EUR/JPY', 'EUR/USD', 'GBP/USD', 'GBP/EUR',
  'SGD/MYR', 'AUD/JPY',
]

export function formatCurrencyRate(code: string, rate: number): string {
  const decimals = CURRENCY_DECIMALS[code] ?? 4
  return code + ' ' + rate.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
