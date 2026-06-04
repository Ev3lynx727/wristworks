export const COUNTRY_CURRENCY: Record<string, string> = {
  ID: 'IDR', GB: 'GBP', JP: 'JPY', US: 'USD', DE: 'EUR', FR: 'EUR',
  IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR',
  IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'LVL', LT: 'EUR', MT: 'EUR', CY: 'EUR', HR: 'EUR',
  AU: 'AUD', KR: 'KRW', TH: 'THB', SG: 'SGD', MY: 'MYR', CN: 'CNY',
  IN: 'INR', PH: 'PHP', VN: 'VND', CH: 'CHF', CA: 'CAD', NZ: 'NZD',
  HK: 'HKD', TW: 'TWD', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', TR: 'TRY', ZA: 'ZAR',
  MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
  EG: 'EGP', NG: 'NGN', KE: 'KES', MA: 'MAD', DZ: 'DZD', TN: 'TND',
  SA: 'SAR', AE: 'AED', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
  JO: 'JOD', LB: 'LBP', IL: 'ILS', RU: 'RUB', UA: 'UAH', KZ: 'KZT',
  PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR', MM: 'MMK', KH: 'KHR',
  LA: 'LAK', MN: 'MNT', FJ: 'FJD', PG: 'PGK', MO: 'MOP', BN: 'BND',
  MV: 'MVR', BT: 'BTN', AF: 'AFN', IR: 'IRR', IQ: 'IQD', SY: 'SYP',
  YE: 'YER', PS: 'ILS', AZ: 'AZN', GE: 'GEL', AM: 'AMD', AL: 'ALL',
  MK: 'MKD', RS: 'RSD', ME: 'EUR', BA: 'BAM', MD: 'MDL', BY: 'BYN',
  IS: 'ISK', FO: 'DKK', GI: 'GIP', MC: 'EUR', LI: 'CHF', AD: 'EUR',
  SM: 'EUR', VA: 'EUR',
}

export function currencyForCountry(countryCode: string): string | undefined {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()]
}

export function uniqueCurrenciesForTargets(countryCodes: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const cc of countryCodes) {
    const cur = currencyForCountry(cc)
    if (cur && !seen.has(cur)) {
      seen.add(cur)
      result.push(cur)
    }
  }
  return result
}
