# BHARATCLAP COD FINANCIAL CONTRACT & ARCHITECTURAL SPECIFICATION

**Version:** 1.0.0 (Production Authoritative)  
**Status:** Frozen / Production Ready  
**Last Updated:** August 9, 2026  
**Authoritative Implementation File:** `provider-service/src/models/LedgerEntry.ts`

---

## ⚠️ MANDATORY RULE: LEDGER DEBIT/CREDIT CONVENTION

> **CRITICAL ARCHITECTURAL GUARANTEE:**
> `LedgerEntry.ts` defines the authoritative implementation of BharatClap's double-entry debit/credit convention.
> 
> **DO NOT INVERT `debit_account` AND `credit_account` BASED ON CONVENTIONAL EXTERNAL ACCOUNTING ASSUMPTIONS.**
> 
> In BharatClap's accounting model:
> - **DEBIT ACCOUNT**: Asset / Cash Inflow / Holding Account (`HUB_CASH_ACCOUNT`, `ONLINE_UPI`, `CUSTOMER_ESCROW`)
> - **CREDIT ACCOUNT**: Debt Liability Reduction / Revenue / Tax Payable (`PROVIDER_COD_LIABILITY`, `PLATFORM_COMMISSION_REVENUE`, `GOVT_GST_PAYABLE`)
> 
> **Example (Hub Cash Remittance of ₹885):**
> - **DEBIT**: `HUB_CASH_ACCOUNT` (+₹885 Asset Inflow)
> - **CREDIT**: `PROVIDER_COD_LIABILITY` (-₹885 Debt Liability)
> - **Balance Equation**: $\text{Total Assets (+₹885)} = \text{Total Liabilities (-₹885)} + \text{Equity (₹0)} \implies \text{Difference} = \mathbf{₹0}$

---

## 1. Service Ownership Matrix

| Financial State / Domain | Owning Microservice | Authoritative Model | Key API / Endpoint |
| :--- | :--- | :--- | :--- |
| **Booking & Payment Snapshot** | `booking-service` | `Booking` | `POST /api/bookings/:id/complete` |
| **Outbox Queue & Polling** | `booking-service` | `SettlementOutbox` | `processSettlementOutbox()` worker |
| **Provider Liability & Settlements** | `provider-service` | `ProviderSettlement` | `POST /api/providers/internal/settlements/create` |
| **Double-Entry Financial Ledger** | `provider-service` | `LedgerEntry` | `POST /api/providers/admin/cod/record-cash` |
| **Dispatch Lock / Unlock** | `provider-service` | `Provider` | `checkAndToggleDispatchBlock()` |

---

## 2. Full End-to-End COD Financial Lifecycle

```
                     BOOKING (₹5,000)
                            │
                            ▼
                   Financial Snapshot
                            │
                            ▼
                      COD ₹5,000
                            │
                            ▼
                   Service Completed
                            │
                            ▼
                   Customer Pays ₹5,000
                            │
                            ▼
                   SettlementOutbox
                            │
                            ▼
                   ProviderSettlement
            ┌───────────────┴───────────────┐
            ▼                               ▼
     Provider Share                   Platform Due
        ₹4,115                            ₹885
                                            │
                                            ▼
                                  Provider COD Liability
                                            │
                                     Admin collects
                                       ₹885 cash
                                            │
                                            ▼
                                     Immutable Ledger
                                            │
                                            ▼
                                     Liability = ₹0
                                            │
                                            ▼
                                  Dispatch Unblocked
```

---

## 3. Financial Equations & Reconciliation Rules

### 3.1 Gross Booking Breakdown
$$\text{Customer Paid COD} = \text{Platform Commission} + \text{GST on Commission} + \text{Provider Net Share}$$

**Standard Example (₹5,000 Booking @ 15% Commission Rate):**
- **Gross Booking Amount**: ₹5,000.00
- **Platform Commission (15%)**: ₹750.00
- **18% GST on Commission**: ₹135.00
- **Total Platform COD Due (Liability)**: ₹750 + ₹135 = **₹885.00**
- **Provider Net Share**: ₹5,000 - ₹885 = **₹4,115.00**
- **Unexplained Financial Difference**: **₹0.00**

---

## 4. `SettlementOutbox` State Machine & DLQ Governance

```
 [PENDING] ──(Worker Attempt < 10)──► [DELIVERED] (HTTP 200 / HTTP 409)
     │
     └──(Worker Attempt >= 10)─► [DLQ] (Surfaced to Admin Console)
```

1. **`PENDING`**: Outbox record enqueued upon booking completion.
2. **`DELIVERED`**: HTTP 200 (created) or HTTP 409 (already settled via idempotency guard). Worker stops retrying.
3. **`FAILED`**: Network or temporary error. Retried automatically up to 10 attempts.
4. **`DLQ`**: Exhausted 10 attempts. Moved to Dead Letter Queue for admin inspection. DLQ count = 0 in normal operation.

---

## 5. Cash Settlement Tolerance & Overpayment Governance

- **Server-Side Configuration**: `COD_SETTLEMENT_TOLERANCE` (Default: `₹1.00`).
- **Formula**:
  $$\text{Raw Diff} = \text{Cash Received} - \text{Previous COD Balance}$$
- **Rules**:
  - If $\text{Raw Diff} \le 0$: Full reduction applied.
  - If $0 < \text{Raw Diff} \le \text{Settlement Tolerance}$: Allowed. `settlement_tolerance_adjustment` recorded in metadata; `newCodBalance` set to `0.00`.
  - If $\text{Raw Diff} > \text{Settlement Tolerance}$: Rejected with **HTTP 400 Bad Request**.

### Audit Metadata Format on Ledger:
```json
{
  "source": "hub_cash",
  "previous_cod_balance": 229.923,
  "cash_received": 230.000,
  "settlement_tolerance_adjustment": 0.077,
  "rounding_adjustment": 0.077,
  "balance_after": 0
}
```

---

## 6. Immutability & Fault Isolation Rules

1. **Ledger Immutability**: `LedgerEntry` schema strictly enforces pre-hooks throwing exceptions on `updateOne`, `findOneAndUpdate`, `deleteOne`, and `findOneAndDelete`.
2. **Idempotency Guard**: Requests passing an existing `reference_id` return `200 OK` with `alreadyProcessed: true` and the original receipt data without creating duplicate ledger records.
3. **Notification Fault Isolation**: In-app push/SMS notifications execute in isolated non-fatal `try/catch` blocks. Notification server downtime or failure **never** rolls back or crashes financial database commits.
