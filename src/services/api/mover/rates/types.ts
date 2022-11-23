export enum CurrencyCode {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP'
}

export type Rates = Record<CurrencyCode, number>;
export type MultiRates = Record<number, Rates>;
