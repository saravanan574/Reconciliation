# Ledger — Order/Payment Reconciliation

A small full-stack app that ingests an orders export and a payments export, reconciles
them deterministically, and presents the result as a dashboard: headline numbers, a
breakdown by discrepancy type, and a filterable drill-down table. An LLM layer adds a
plain-language explanation on top of the (already-decided) results — it never decides
whether two records match.

**Stack:** React (Vite) · Node.js/Express · MongoDB (Mongoose) · OpenAI API

---

## 1. Setup and running locally

### Prerequisites
- Node.js 18+
- A MongoDB instance — either local (`mongod` running on `localhost:27017`) or a free
  [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- An OpenAI API key (optional for everything except the "Explain with AI" feature)

### Backend

```bash
cd backend
cp .env.example .env
# edit .env: set MONGO_URI, JWT_SECRET, OPENAI_API_KEY
npm install
npm run dev        # starts on http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.example .env
# edit .env if your backend isn't on localhost:4000
npm install
npm run dev         # starts on http://localhost:5173
```

Open `http://localhost:5173`, sign up with any email/password (8+ characters), and
upload `sample-data/orders.csv` + `sample-data/payments.csv` from the repo root — these
are the original files from the assignment brief, included so the app can be exercised
immediately without hunting for test data.

### Quick sanity check of the reconciliation logic (no DB required)

```bash
cd backend
node scripts/dry_run_check.mjs
```

This re-implements the matching logic against the sample CSVs directly (bypassing
Mongo) and prints discrepancy counts by type — useful for verifying the engine after
changing a rule, or for reviewers who want to see the logic run without standing up a
database.

---

## 2. Architecture

```
frontend (React/Vite)  →  backend (Express API)  →  MongoDB
                              ↓
                         OpenAI API (explain only)
```

- **Auth**: email/password, bcrypt-hashed, JWT bearer tokens (Authorization: Bearer token), 
  it will 7-day expiry. Every data route runs through `requireAuth` middleware and
  every query is scoped with `user: req.user.id` at the database level — there is no
  endpoint that returns another user's rows.

- **Ingestion**: `POST /api/ingest/upload` accepts two CSV files (in-memory via
  Multer, never written to disk unmodified), parses them, normalizes and stores them as
  `Order`/`Payment` documents tagged with a `batchId`, then immediately runs the
  reconciliation engine and returns the resulting run summary.

- **Reconciliation engine** (`services/reconciliationEngine.js`): pure,
  deterministic functions — no I/O besides the Mongo reads/writes at the start and end.
  Given the same two files, it always produces the same discrepancies. It does not call
  an LLM.

- **Dashboard/API**: `GET /api/dashboard/summary`, `GET /api/discrepancies` 
  (filterable:type, severity, status, search, pagination), `GET /api/discrepancies/:id` 
  (full detail, with the underlying order/payment rows populated).

- **LLM layer** (`services/llmService.js`): `POST /api/explain` takes a list
  of discrepancy IDs already owned by the requesting user, hands the engine's own
  structured output (type, amounts, deterministic summary) to OpenAI, and it gives
  only for a plain-language explanation and recommended action.

Data model: `User`, `Order`, `Payment`, `Discrepancy`, `ReconciliationRun` (a snapshot
of headline numbers per import, so the dashboard doesn't have to recompute aggregates
live on every page load).

---

## 3. Reconciliation logic

### Matching
Orders are matched to payments on `order_id` <-> `order_reference`, normalized with
`.trim().toUpperCase()` before comparison. This single normalization step is what
correctly matches payment rows like `ord-1801` to order `ORD-1801` instead of
reporting them as missing.

### Tolerance
A money difference is only reported if it exceeds **the larger of $0.05 or 0.5% of the
order value**. A flat cent tolerance would be too tight on a $400 order and too loose on
a $9 one; a pure percentage tolerance breaks down near zero. Anything inside that band
is treated as float/rounding noise (e.g. a 2-cent gap between `net_amount` and `amount`
on ORD-1902) and is not surfaced — the brief specifically warns against inventing false
discrepancies, and a tolerance that's too tight does exactly that.

### Discrepancy types
| Type | Condition | Severity |
|---|---|---|
| `MISSING_PAYMENT` | Completed order, no settled charge found anywhere | high |
| `ORPHAN_PAYMENT` | Settled charge whose order reference matches no order in the batch | medium |
| `PAYMENT_NOT_SETTLED` | Completed order, only a `pending`/`failed` charge exists | high if failed, medium if pending |
| `DUPLICATE_CHARGE` | 2+ settled charges of the *same amount* on one order, not offset by a refund | high |
| `AMOUNT_MISMATCH` | Net settled ≠ order value beyond tolerance, and it isn't a duplicate-charge or refund case | high (overcharged) / medium (undercharged) |
| `REFUND_SHORTFALL` | Order is `refunded` (or a partial refund exists) but the amount actually refunded doesn't bring net-settled back to the expected value | high |
| `CANCELLED_BUT_CHARGED` | Order is `cancelled` but a net positive amount was still collected | high |
| `CURRENCY_MISMATCH` | Order and payment amounts agree numerically, but the `currency` field disagrees | low (informational — flagged as a likely data-entry bug, not a real FX event) |
| `DUPLICATE_ORDER_RECORD` | The same normalized `order_id` appears more than once in `orders.csv` as *different* rows (not an exact duplicate, which is silently deduped instead) | high if the amounts differ between records, medium if they match |

### Handling one-to-many and many-to-many cases explicitly

The brief assumes "in theory, every order has exactly one matching payment" — in
practice that 1:1 assumption breaks in several directions, and the engine is written to
handle each rather than assume it away:

- **One order, multiple payment transactions** (the common case): a duplicate charge, a
  charge + refund, or a charge + a failed retry can all land on the same order. The
  engine never looks at a single payment in isolation for a matched order — it always
  sums *all* settled charges and *all* settled refunds for that order first
  (`totalCharged`, `totalRefunded`), then compares the net to the order's expected
  value. This is what correctly nets `ORD-1703` (charge $99 + refund $99 → $0 collected)
  and `ORD-1702` (charge $240 + refund $120 → $120 still collected) to the right numbers
  instead of reacting to just the first payment row found.

- **One order id, multiple order records** (`DUPLICATE_ORDER_RECORD`, above): if two
  different rows in `orders.csv` claim the same order id, matching only the first one
  against payments would silently double-count that payment against a "second" order and
  invent a false missing-payment finding on it. Instead the collision itself is
  reported, and only one representative record (the earliest by date) is used for the
  money reconciliation, so a payment is never matched more than once.

- **One payment reference, multiple untraceable transactions** (`ORPHAN_PAYMENT`): if
  several charges/refunds reference an order id that doesn't exist at all, they're
  grouped into a single discrepancy per reference (not one row per transaction) so a
  reviewer sees "3 transactions on a nonexistent order, netting to $X" instead of three
  disconnected alerts. Orphan **refunds** (money going out against an order that was
  never recorded) are included here too, at higher severity than orphan charges, since a
  refund with no traceable originating order is the more unusual/concerning case.

- **Exact duplicate rows** in either CSV (a byte-for-byte repeated line — an export
  artifact, not a business event) are deduplicated silently at ingest and reported only
  as a data-quality note, not a discrepancy, since they aren't a second real-world event.

The included `backend/scripts/dry_run_check.mjs` mirrors this grouping logic and was
used to confirm it against synthetic edge cases (a duplicate order record with
differing amounts, and a charge+refund pair both referencing a nonexistent order) before
being applied to the real sample data.

Order status drives which branch of logic runs (`completed` / `cancelled` / `refunded`),
because "no matching payment" means something different for each: a missing payment on
a completed order is lost revenue; on a cancelled order it's expected; on a refunded
order it means we can't verify the refund happened at all.

Every discrepancy carries a **deterministic, auto-generated `summary` string** built
from the numbers — this is what's shown in the drawer before any AI call is made, and
it's what the LLM is later asked to explain, not re-derive.

### Why not more/fewer types?
I stopped at eight because every one of them is backed by a real pattern actually found
in the data — I didn't want to add speculative categories ("possible fraud",
"chargeback risk") that the data doesn't demonstrate, per the brief's instruction not to
invent problems.

---

## 4. What was actually wrong with the data

Running the engine against the provided `orders.csv` (186 rows) and `payments.csv` (188
rows) surfaces **19 real discrepancies** and **3 silent data-cleanup steps**:

**Silent fixes (not reported as discrepancies, but would cause false positives without them):**
- One exact duplicate row in `orders.csv` (`ORD-1004`,repeated) — deduplicated on ingest.
- Two payment rows reference orders as `" ord-1801 "` and `"ord-1802 "` (whitespace/case) instead of
 `ORD-1801`/`ORD-1802`. Without normalizing before matching, these would show up as two or more 
 "missing payments" that don't actually exist.
- One order row is missing `customer_email`, one payment row is missing `processed_at` — logged as 
  data-quality notes, doesn't block matching.

**Real discrepancies found:**
- **4 missing payments** — completed orders with no payment record at all (e.g. `ORD-1201`–`ORD-1204`).
  This is money the store believes it earned that was never actually collected.
- **3 orphan payments** — settled charges (`ORD-1301`, `1302`, `1303`) referencing order IDs that 
  don't exist anywhere in `orders.csv`. Either the order export is incomplete, or these are payments 
  for orders placed outside the tracked system.
- **2 duplicate charges** — `ORD-1501` and `ORD-1502` were each charged twice, same amount, ~30 minutes 
  apart, both settled, no refund. Customers were double-billed.
- **3 amount mismatches** — `ORD-1401`, `1402`, `1403` show a different net amount in `orders.csv` than 
  what was actually settled (differences of $18.50–$60), too large to be rounding.
- **2 refund shortfalls** — `ORD-1702` is marked `refunded` but only half the charge ($120 of $240) was 
  actually refunded. `ORD-1703` is marked `completed` but has a matching charge *and* an equal refund, 
  netting to $0 actually collected — the order status was never updated to reflect the refund.
- **1 cancelled-but-charged order** — `ORD-1701` is `cancelled` in the order system but has a settled 
  charge against it that was never refunded.
- **2 payments stuck non-settled** — `ORD-2001`'s payment is `failed` and `ORD-2002`'s is `pending`, but 
  both orders are `completed` status, meaning the store believes it was paid when it hasn't been (or not yet).
- **2 currency-label mismatches** — `ORD-1601`/`ORD-1602` have identical numeric amounts in both files, 
  but the `currency` field disagrees (`USD` vs `EUR`). Given the amounts are exactly equal, this reads as a 
  data-entry/export bug, not a real currency conversion.

**What this means for the business:** money is leaking in three distinct ways — orders
that were never actually paid ($MISSING_PAYMENT + failed payments), orders that were
overcharged and not corrected (duplicates, amount mismatches), and refunds/cancellations
that didn't fully claw back money that was already collected. The dashboard's "total at
risk" figure is the sum of all of these — it's the number a revenue lead should look at
first.

---

## 5. LLM approach

- **Where it runs:** exclusively in `backend/src/services/llmService.js`, called from
  `POST /api/explain`. The API key never leaves the server; the frontend only ever sees
  the JSON response.
- **What it's given:** only the *already-computed* facts for the selected discrepancies
  — type, severity, amount at risk, currency, the engine's own summary string, and the
  structured `details` object. It is explicitly told in the system prompt that these
  facts are final and it must not dispute or re-derive them.
- **Structured output:** requested via OpenAI's `response_format: json_schema` (strict
  mode) with a schema requiring `overall_assessment` plus a `items[]` array of
  `{ order_ref, likely_cause, recommended_action, confidence }`. If the response is
  missing, isn't valid JSON, or doesn't match the expected shape, the backend returns
  `{ ok: false, error }` instead of throwing, and the frontend shows a retry button
  rather than a broken page.
- **Temperature: 0.2.** The explanations are meant to be a consistent read of facts that
  are already fixed, not a creative task — a stakeholder shouldn't get a materially
  different "cause" for the same discrepancy on two different calls. Full determinism
  (0) wasn't necessary and made repeated short explanations feel stilted in testing, so
  0.2 was chosen as a small amount of phrasing variety without inconsistent conclusions.
- **Batching:** the endpoint accepts up to 25 discrepancy IDs per call so a user can
  select several rows and get one coherent narrative instead of firing one request per
  row.

---

## 6. What I'd improve with more time
- Async/background reconciliation for large files (currently synchronous in the
  request — fine for hundreds of rows, not for millions) with a job queue and
  progress polling.
- Multi-currency support with real FX conversion instead of flagging currency
  mismatches as informational only.
- A configurable tolerance (currently a fixed 0.5%/$0.05 rule) exposed per user, since
  what counts as "material" varies by business.
- Streaming the LLM response so the explanation panel fills in progressively instead of
  waiting for the full JSON payload.
- Audit history on `Discrepancy.status` changes (who resolved what, when) instead of a
  single mutable field.
- Export (CSV/PDF) of the drill-down table for sharing outside the app.

---

## 7. Use of AI tools

This project was built with the help of an AI coding assistant (Claude). I used it to
scaffold boilerplate (Express routing, Mongoose schemas, React components) and to speed
up the CSV exploration that fed into the reconciliation rules, but every rule,
tolerance, and discrepancy type reflects an explicit decision made after inspecting the
actual data — none of it is guessed or templated, and I can walk through any
part of it.

---
