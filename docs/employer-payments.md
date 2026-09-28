# Employer payments, wallet & GST invoices

Sheet items **358–365** (and wallet **351–357**). Checkout uses Razorpay when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set. Without keys, `paymentProvider` stays `simulated`.

## Flow

1. `POST /api/v1/employer/payments/checkout` — pending payment with GST breakdown (`BILLING_MANAGE`).
2. `POST /api/v1/employer/payments/:id/confirm` — activates subscription **or** credits wallet + issues GST invoice.
3. `POST /api/v1/employer/payments/:id/fail` — simulated decline.
4. `POST /api/v1/admin/payments/:id/refund` — admin refund; credit packs claw back wallet on full refund.

## Key routes

| Method | Path | Notes |
|--------|------|--------|
| GET | `/employer/credit-packs` | Pack catalogue |
| GET | `/employer/wallet` | Balance |
| GET | `/employer/wallet/transactions` | Ledger |
| GET | `/employer/payments` | History / status |
| GET | `/employer/invoices` | GST invoices |
| POST | `/employer/payments/checkout` | `kind`: `subscription` \| `credits` |
| POST | `/employer/payments/:id/confirm` | Simulated capture |
| POST | `/employer/payments/:id/fail` | Simulated decline |
| POST | `/admin/payments/:id/refund` | Refund handling |

## GST

- Company with GSTIN → CGST 9% + SGST 9%.
- Otherwise → IGST 18%.
- Invoice numbers: `WI-{year}-{seq}`.

## Wallet spend

When plan entitlements are exhausted:

- Contact unlock → 1 credit (`spend_unlock`)
- Featured job → 10 credits (`spend_featured`)
- Boost notify → 5 credits (`spend_boost`)
