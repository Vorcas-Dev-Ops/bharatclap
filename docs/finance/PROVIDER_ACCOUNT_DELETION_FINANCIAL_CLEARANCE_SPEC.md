# BharatClap — Provider Account Deletion & Financial Clearance Specification

## 1. Critical Rule

Deleting a Provider account does **not** automatically refund every balance shown in the provider wallet.

Provider financial balances must first be classified into:
- **Earnings owed to provider** → must be settled/payout.
- **Purchased wallet balance** → eligible for refund/settlement according to BharatClap's wallet terms and applicable law, subject to Admin approval.
- **Promotional/free-trial/sponsored credit** → normally non-refundable and forfeited according to applicable wallet/subscription terms.
- **Outstanding provider liability** → deducted/adjusted before final settlement.
- **Pending financial dispute** → deletion remains financially pending until resolved.

> **Core Principle**: Account deletion and financial closure are separate but connected processes. The provider's personal account can have its PII deleted/anonymized while the financial ledger and legally required records remain preserved.

---

## 2. Provider Deletion Financial Workflow

```text
Provider confirms account deletion
              ↓
Immediate session revocation
              ↓
Block new jobs / leads / wallet activity
              ↓
Check provider obligations
              ↓
┌──────────────────────────────────────┐
│ Unified Admin Financial Review Gate  │
└──────────────────────────────────────┘
              ↓
       Classify financial position
              │
      ┌───────┼────────┬─────────────┐
      ↓       ↓        ↓             ↓
   Earnings  Purchased Promotional  Liability/
     owed      wallet     credit      dispute
      ↓         ↓          ↓             ↓
   Payout    Review      Forfeit       Resolve/
              refund     explicitly     adjust
      │         │          │             │
      └─────────┴──────────┴─────────────┘
                       ↓
             Financially Cleared
                       ↓
              Complete deletion
```

---

## 3. Financial Classification

The deletion worker must never infer refundability from the provider's current wallet balance alone.

**Example**:
A provider wallet showing **₹1,500** does **not** mean *Refund ₹1,500*. The immutable ledger must be inspected:

| Wallet Component | Amount | Treatment |
| :--- | :--- | :--- |
| Purchased wallet credit | ₹1,000 | Admin reviews refund eligibility |
| Promotional credit | ₹300 | Forfeit |
| Promotional lead credit | ₹200 | Forfeit |
| **Total displayed balance** | **₹1,500** | **Not automatically refundable** |

---

## 4. Wallet Transaction Classification Data Types

Every wallet transaction carries enough information to establish its origin:

```typescript
export type WalletCreditSource =
  | 'PURCHASED'
  | 'PROMOTIONAL'
  | 'FREE_TRIAL'
  | 'SPONSORED'
  | 'REFUND'
  | 'ADMIN_CREDIT'
  | 'OTHER';

export type FinancialDisposition =
  | 'SETTLE_TO_PROVIDER'
  | 'REFUND_TO_PROVIDER'
  | 'FORFEIT'
  | 'OFFSET_LIABILITY'
  | 'PENDING_REVIEW';
```

The system calculates:
- Purchased Credit
- Promotional Credit
- Provider Earnings
- Outstanding Liability
- Pending Settlement
- Pending Refund

rather than using `wallet.balance`.

---

## 5. Provider Earnings Must Be Settled

If the provider has completed jobs and BharatClap owes money to the provider:

```text
Completed Jobs → Provider Earnings → Settlement Ledger → Bank Payout
```

**Example**:
- Provider earnings: ₹8,500
- Commission/liability: ₹1,000
- **Net payable**: ₹7,500

The provider receives ₹7,500 subject to the normal settlement cycle, bank verification, and legitimate holds/disputes. The PII is subsequently deleted while accounting records are retained.

---

## 6. `PROCESSING_SETTLEMENT_PENDING` Sub-State

Settlement processing must have a dedicated sub-state: **`PROCESSING_SETTLEMENT_PENDING`** (*Awaiting Bank Payout Clearance*).

It must **not** be treated as `FAILED` and must **not** cause the deletion worker to continuously retry the entire account-deletion workflow.

```text
Provider deletion → ₹7,500 payable → Settlement created → Bank processing → PROCESSING_SETTLEMENT_PENDING → Bank confirms payout → FINANCIAL_CLEAR → Account deletion continues
```

The Admin Console displays: **Awaiting Bank Payout Clearance** with the associated settlement reference.

---

## 7. Purchased Wallet / Subscription Balance

Suppose the provider purchased ₹2,000 wallet credit and has ₹700 remaining. That ₹700 is not automatically refunded.

The system determines:
1. Was the ₹700 purchased?
2. Was it promotional?
3. Was it consumed?
4. Is it refundable under terms?
5. Is there an outstanding liability?

- **If Refundable**: Admin explicitly selects **Refund Purchased Balance**. System records `refund_amount`, `admin_user_id`, `timestamp`, `reason`, `wallet_transaction_refs`, `refund_reference`, and `payment_reference`.
- **If Non-Refundable**: Admin explicitly selects **Forfeit Non-Refundable Balance**.

---

## 8. Promotional / Free Credits

Promotional balances (`Free Trial Credit`, `Promotional Wallet Credit`, `Sponsored Leads`, `Admin Promotional Credit`, `Bonus Credit`) are generally **NON_REFUNDABLE** when applicable terms state so.

The system records the forfeiture even for ₹0:

```json
{
  "event": "FORFEITED_PROMOTIONAL_CREDIT_ON_DELETION",
  "amount_paise": 20000,
  "admin_user_id": "admin_6019a2b",
  "timestamp": "2026-08-10T16:24:00Z",
  "reason": "Promotional credit is non-refundable under wallet terms"
}
```

---

## 9. Unified Admin Review Gate

There is **one** financial clearance gate in the Admin Console:

```text
Provider Financial Snapshot
Provider Earnings Owed       ₹8,500
Pending Settlement           ₹8,500
Purchased Wallet Credit      ₹700
Promotional Credit           ₹300
Outstanding Liability        ₹0
Open Dispute                 No
Financial Status             REVIEW_REQUIRED
```

---

## 10. Explicit Admin Actions

Money movement requires explicit Admin actions in the console:

- **Action 1 — Settle Provider Earnings**: `[ Initiate Settlement ]`
- **Action 2 — Refund Purchased Wallet Balance**: `[ Refund Purchased Balance ]`
- **Action 3 — Forfeit Promotional Credit**: `[ Forfeit Promotional Credit ]` (`FORFEITED_PROMOTIONAL_CREDIT_ON_DELETION`)
- **Action 4 — Offset Liability**: `[ Offset Liability ]`

---

## 11. Segregation of Duties

The background worker automatically calculates snapshots, identifies transactions, detects obligations, and executes approved decisions.

**The worker never silently moves real money without explicit Admin authorization.**

---

## 12. Provider Deletion State Separation

`FinancialClearanceStatus` is kept separate from `AccountDeletionRequest` status:

```typescript
export type FinancialClearanceStatus =
  | 'NOT_REQUIRED'
  | 'REVIEW_REQUIRED'
  | 'SETTLEMENT_PENDING'
  | 'PROCESSING_SETTLEMENT_PENDING'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PROMOTIONAL_CREDIT_FORFEITED'
  | 'LIABILITY_PENDING'
  | 'FINANCIALLY_CLEARED'
  | 'FAILED_NEEDS_REVIEW';
```

---

## 13. Customer Refunds After Provider Deletion

Deleting a provider never breaks customer refunds. Customer refunds use immutable references (`booking_id`, `payment_intent_id`, `razorpay_payment_id`). The deleted provider's anonymized identifier (`DELETED_USER_XXX`) is sufficient for historical audit association.

---

## 14. Important Production Rule

> **Never delete a provider's financial identity before all financial obligations have been deterministically resolved or transferred to immutable retained records.**
