/**
 * money.ts — Centralized financial arithmetic for BharatClap
 *
 * ALL monetary calculations MUST go through this module.
 * Never use Number() / parseFloat() / parseInt() / toFixed() for financial math.
 *
 * Chain: PG NUMERIC → string → Decimal → calculation → .toFixed(2) → PG NUMERIC
 *
 * Usage:
 *   import { Money } from '@bharatclap/shared';
 *
 *   const gross = Money.from(payableAmount);          // from string/number
 *   const commission = Money.percentage(gross, 20);   // 20% of gross
 *   const gst = Money.percentage(commission, 18);     // 18% GST on commission
 *   const net = gross.sub(commission).sub(gst);
 *
 *   // For PG parameterized query:
 *   await client.query('INSERT ... VALUES ($1)', [net.toPg()]);
 *
 *   // Paise conversion (Razorpay):
 *   const paise = Money.fromPaise(rzpAmount);         // integer paise → rupees
 *   const paiseInt = Money.toPaise(rupeeAmount);      // rupees → integer paise
 */
import Decimal from 'decimal.js';

// Configure Decimal.js for financial use:
// - 20 significant digits (more than enough for ₹999,999,999.99)
// - ROUND_HALF_UP (standard financial rounding)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/** Scale for INR amounts (2 decimal places) */
const INR_SCALE = 2;

/**
 * Immutable monetary value. Wraps Decimal.js with financial-specific operations.
 * All arithmetic returns a new Money instance (immutable).
 */
export class Money {
  private readonly _value: Decimal;

  private constructor(value: Decimal) {
    this._value = value;
  }

  // ═══════════════════════════════════════════════════════
  // Construction
  // ═══════════════════════════════════════════════════════

  /**
   * Create Money from a string, number, or Decimal.
   * Preferred input: string from PG driver (preserves precision).
   * Accepts number for backward compatibility but logs a warning in dev.
   */
  static from(value: string | number | Decimal): Money {
    if (value instanceof Decimal) return new Money(value);
    // ponytail: Accept number for backward compat during migration.
    // After full PG migration, consider making number input a dev-mode warning.
    return new Money(new Decimal(value));
  }

  /** Create Money representing zero */
  static zero(): Money {
    return new Money(new Decimal(0));
  }

  /**
   * Create Money from Razorpay paise (integer).
   * Razorpay amounts are always in paise (1 rupee = 100 paise).
   */
  static fromPaise(paise: number | string): Money {
    return new Money(new Decimal(paise).div(100));
  }

  // ═══════════════════════════════════════════════════════
  // Arithmetic (all return new Money, immutable)
  // ═══════════════════════════════════════════════════════

  /** Add two Money values */
  add(other: Money): Money {
    return new Money(this._value.plus(other._value));
  }

  /** Subtract: this - other */
  sub(other: Money): Money {
    return new Money(this._value.minus(other._value));
  }

  /** Multiply by a scalar (e.g. quantity, NOT for money × money) */
  mul(scalar: number | string | Decimal): Money {
    return new Money(this._value.times(scalar));
  }

  /** Divide by a scalar */
  div(divisor: number | string | Decimal): Money {
    if (new Decimal(divisor).isZero()) {
      throw new Error('Money.div: division by zero');
    }
    return new Money(this._value.div(divisor));
  }

  /** Negate: -amount */
  neg(): Money {
    return new Money(this._value.neg());
  }

  /** Absolute value */
  abs(): Money {
    return new Money(this._value.abs());
  }

  // ═══════════════════════════════════════════════════════
  // Financial operations
  // ═══════════════════════════════════════════════════════

  /**
   * Calculate percentage: amount * rate / 100
   * Example: Money.percentage(gross, 20) → 20% of gross
   */
  static percentage(amount: Money, rate: number | string): Money {
    return amount.mul(rate).div(100);
  }

  /**
   * Round to INR scale (2 decimal places), ROUND_HALF_UP.
   * Call this at the final step before output, not between intermediate calculations.
   */
  round(): Money {
    return new Money(this._value.toDecimalPlaces(INR_SCALE, Decimal.ROUND_HALF_UP));
  }

  // ═══════════════════════════════════════════════════════
  // Comparisons
  // ═══════════════════════════════════════════════════════

  isZero(): boolean { return this._value.isZero(); }
  isPositive(): boolean { return this._value.isPositive() && !this._value.isZero(); }
  isNegative(): boolean { return this._value.isNegative(); }
  gte(other: Money): boolean { return this._value.gte(other._value); }
  lte(other: Money): boolean { return this._value.lte(other._value); }
  gt(other: Money): boolean { return this._value.gt(other._value); }
  lt(other: Money): boolean { return this._value.lt(other._value); }
  eq(other: Money): boolean { return this._value.eq(other._value); }

  // ═══════════════════════════════════════════════════════
  // Output
  // ═══════════════════════════════════════════════════════

  /**
   * For PostgreSQL NUMERIC parameter: returns string with exactly 2 decimal places.
   * Use this in parameterized queries: `$1` → money.toPg()
   */
  toPg(): string {
    return this._value.toFixed(INR_SCALE);
  }

  /**
   * Convert to integer paise for Razorpay API.
   * Rounds to nearest paise first, then converts.
   */
  static toPaise(amount: Money): number {
    return amount._value.times(100).round().toNumber();
  }

  /**
   * Display string with ₹ symbol (for logs/UI, NOT for calculations).
   */
  toDisplay(): string {
    return `₹${this._value.toFixed(INR_SCALE)}`;
  }

  /**
   * Raw number (ONLY for Mongoose backward compatibility during migration).
   * Do NOT use for new PG code.
   */
  toNumber(): number {
    return this._value.toNumber();
  }

  /** String representation */
  toString(): string {
    return this._value.toFixed(INR_SCALE);
  }

  /** For JSON serialization */
  toJSON(): string {
    return this.toPg();
  }
}
