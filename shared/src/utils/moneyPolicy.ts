/**
 * moneyPolicy.ts — Canonical Financial & Rounding Policy for BharatClap
 *
 * Defines the enterprise-wide rules for scale, precision, tax rounding,
 * paise conversion, and database storage across all microservices.
 */
import Decimal from 'decimal.js';

export const MoneyPolicy = {
  /** Canonical ISO-4217 Currency */
  currency: 'INR' as const,

  /** Database column scale for monetary amounts: NUMERIC(12, 2) */
  databaseAmountScale: 2,

  /** Database column scale for rates and percentages: NUMERIC(5, 2) */
  databaseRateScale: 2,

  /** Precision for intermediate Decimal.js calculations (significant digits) */
  calculationPrecision: 20,

  /** Standard financial rounding mode: round half away from zero (standard commercial / banking) */
  roundingMode: Decimal.ROUND_HALF_UP,

  /** Scale for final settlement payouts (INR 2 decimals) */
  settlementScale: 2,

  /** Scale for GST (CGST/SGST/IGST) calculations (INR 2 decimals) */
  gstScale: 2,

  /** Scale for TDS / TCS withholding taxes (INR 2 decimals) */
  tdsScale: 2,
  tcsScale: 2,

  /** Wallet ledger balance scale (INR 2 decimals) */
  walletScale: 2,

  /** Paise multiplier: 1 INR = 100 paise (integer format required by Razorpay) */
  paiseMultiplier: 100,

  /**
   * Safe boundary pipeline:
   * PG NUMERIC string -> Decimal -> Calculation (20 digits) -> Round (scale 2, ROUND_HALF_UP) -> string / paise
   */
  formatPg(decimal: Decimal): string {
    return decimal.toFixed(this.databaseAmountScale, this.roundingMode);
  },

  toPaise(decimal: Decimal): number {
    return decimal.times(this.paiseMultiplier).toDecimalPlaces(0, this.roundingMode).toNumber();
  },

  fromPaise(paise: number | string): Decimal {
    return new Decimal(paise).div(this.paiseMultiplier);
  },

  roundTax(decimal: Decimal): Decimal {
    return decimal.toDecimalPlaces(this.gstScale, this.roundingMode);
  },

  roundSettlement(decimal: Decimal): Decimal {
    return decimal.toDecimalPlaces(this.settlementScale, this.roundingMode);
  },
} as const;

export type MoneyPolicyType = typeof MoneyPolicy;
