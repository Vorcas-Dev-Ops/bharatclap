# BharatClap — Database Index Audit & Specification

> Documented index audit to ensure queries remain performant as data scales.

---

## 1. Booking Service (`booking-service`)

### Collection: `bookings`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ userId: 1, status: 1, createdAt: -1 }` | Compound | Customer booking history queries |
| `{ providerId: 1, status: 1, scheduledDate: 1 }` | Compound | Provider schedule and active job lookups |
| `{ status: 1, scheduledDate: 1 }` | Compound | Dispatch engine dispatchable job scanning |
| `{ booking_id: 1 }` | Unique | Fast lookup by user-facing booking ID |
| `{ isDeleted: 1 }` | Sparse | Soft delete filter optimization |

---

## 2. Auth Service (`auth-service`)

### Collection: `users`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ phone: 1 }` | Unique | User login / OTP verification lookup |
| `{ email: 1 }` | Unique (sparse) | User email lookup |
| `{ role: 1, admin_role: 1 }` | Compound | Admin user authorization checks |
| `{ deletion_scheduled_at: 1, is_anonymized: 1 }` | Compound | DPDPA deletion cron job processing |

---

## 3. Provider Service (`provider-service`)

### Collection: `providers`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ phone: 1 }` | Unique | Provider login lookup |
| `{ isOnline: 1, isAvailable: 1, isApproved: 1 }` | Compound | Dispatch engine provider discovery |
| `{ "serviceCategories": 1 }` | Multikey | Category filtering during dispatch |
| `{ location: "2dsphere" }` | Geospatial | Proximity-based dispatch matching |

### Collection: `provider_settlements`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ providerId: 1, status: 1, createdAt: -1 }` | Compound | Provider settlement history lookups |
| `{ cycleStartDate: 1, cycleEndDate: 1, status: 1 }` | Compound | Settlement processing cron & aging reports |

---

## 4. Payment Service (`payment-service`)

### Collection: `payments`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ bookingId: 1 }` | Unique | Fast booking-to-payment resolution |
| `{ razorpay_payment_id: 1 }` | Sparse / Unique | Webhook callback reconciliation |
| `{ razorpay_order_id: 1 }` | Sparse / Unique | Payment verification lookup |

---

## 5. Refund Service (`refund-service`)

### Collection: `refunds`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ bookingId: 1, idempotencyKey: 1 }` | Unique compound | Prevent duplicate refund creation |
| `{ gatewayRefundId: 1 }` | Sparse | Razorpay refund webhook lookup |
| `{ status: 1, createdAt: -1 }` | Compound | Refund processing queue & reconciliation cron |

---

## 6. Notification & System Collections

### Collection: `notifications`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ user_id: 1, createdAt: -1 }` | Compound | User inbox fetching |
| `{ createdAt: 1 }` | TTL (180 days) | Automatic log retention cleanup |

### Collection: `outbox_events`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ status: 1, created_at: 1 }` | Compound | Outbox worker pending event poll |
| `{ published_at: 1 }` | TTL (7 days) | Automatic published outbox cleanup |

### Collection: `processed_events`
| Index Fields | Type | Purpose |
|---|---|---|
| `{ event_id: 1, consumer: 1 }` | Unique compound | Inbox consumer deduplication |
| `{ processed_at: 1 }` | TTL (30 days) | Automatic inbox record cleanup |
