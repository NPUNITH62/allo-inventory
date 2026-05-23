# Allo Inventory — Take-Home Exercise

A Next.js inventory and order-fulfillment platform for multi-warehouse retail brands, with race-condition-safe product reservations.



---

## Screenshots

### 🛍️ Frontend

#### Product Listing Page
All products with per-warehouse stock levels (green / amber / red badges) and Reserve buttons.

![Product Listing Page](docs/screenshots/product-listing.png)

---

#### Checkout Page — Live Countdown
After clicking Reserve, the user lands here with a 10-minute countdown timer and Confirm / Cancel actions.

![Checkout Pending](docs/screenshots/checkout-pending.png)

---

#### Confirmed Purchase
After clicking "Confirm purchase" — green success banner, stock permanently decremented.

![Checkout Confirmed](docs/screenshots/checkout-confirmed.png)

---

#### Expired Reservation
If the timer runs out, the reservation is auto-released and the user is prompted to browse again.

![Checkout Expired](docs/screenshots/checkout-expired.png)

---

#### Out of Stock Error (409 surfaced in UI)
When another customer grabs the last unit, the UI shows the 409 error — not swallowed silently.

![Out of Stock 409](docs/screenshots/out-of-stock-409.png)

---

### 🔌 API Requests & Responses

#### GET /api/products
Returns all products with available stock per warehouse. Lazy expiry runs before each response.

![GET /api/products](docs/screenshots/api-get-products.png)

---

#### GET /api/warehouses
Returns all warehouse records.

![GET /api/warehouses](docs/screenshots/api-warehouses.png)

---

#### POST /api/reservations — 201 Created
Reserves a unit with a Redis distributed lock. Supports `Idempotency-Key` header.

![POST /api/reservations](docs/screenshots/api-post-reservations.png)

---

#### POST /api/reservations — 409 Conflict
Two concurrent requests for the last unit — exactly one succeeds, the other gets 409.

![409 Conflict](docs/screenshots/api-409-conflict.png)

---

#### POST /api/reservations/:id/confirm — 200 OK & 410 Gone
Confirms a reservation (200) or rejects it if expired (410). Release endpoint also shown.

![Confirm & Release](docs/screenshots/api-confirm-410.png)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Running Locally](#running-locally)
3. [Architecture & Concurrency](#architecture--concurrency)
4. [How Expiry Works in Production](#how-expiry-works-in-production)
5. [Idempotency (Bonus)](#idempotency-bonus)
6. [API Reference](#api-reference)
7. [Trade-offs & Future Work](#trade-offs--future-work)

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (end-to-end) |
| Database | PostgreSQL via Prisma ORM |
| Hosted DB | Supabase / Neon / Railway (free tier) |
| Distributed lock | Redis via ioredis (Upstash recommended) |
| Validation | Zod |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Running Locally

### Prerequisites

- Node.js 18+
- A hosted Postgres instance (Supabase, Neon, or Railway all have free tiers)
- A Redis instance (Upstash has a generous free tier; also works with a local Redis)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/allo-inventory.git
cd allo-inventory
npm install
```

### 2. Set environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"
REDIS_URL="rediss://:password@hostname:6379"
RESERVATION_MINUTES=10
CRON_SECRET="any-long-random-string"
```

### 3. Run migrations & seed

```bash
# Push the schema to your database and generate the Prisma client
npm run db:push

# Seed with 3 warehouses, 5 products, and stock records
npm run db:seed
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Architecture & Concurrency

### The core problem

When a customer clicks **Reserve**, we must:

1. Check that `available = total − reserved ≥ quantity`
2. Increment `reserved` by `quantity`
3. Create a `Reservation` row

If two requests arrive simultaneously for the last unit, both could pass the availability check before either increments `reserved` — a classic lost-update race.

### Solution: Redis distributed lock + Postgres transaction

```
Request → Acquire Redis lock (SET NX PX 5000) on key "lock:stock:{productId}:{warehouseId}"
         └─ Lock acquired  → run Prisma $transaction { SELECT stock, UPDATE stock, INSERT reservation }
                             → release lock
         └─ Lock not acquired → 503 "try again"
```

**Why two layers?**

- The **Redis lock** prevents two Node processes (across Vercel serverless functions) from entering the critical section at the same time. A single-process advisory lock wouldn't work in a horizontally-scaled deployment.
- The **Postgres transaction** guarantees that the read (`stock.reserved`) and write (`stock.reserved += quantity`) are atomic within a single connection. Even if the Redis lock somehow failed, Postgres serialization would prevent double-booking — though a bare transaction without the lock could still produce stale reads under high concurrency.

**Lock implementation details**

- `SET key token PX 5000 NX` — sets the lock only if it doesn't exist, with a 5-second TTL as a safety net in case the process crashes.
- Release uses a Lua script to check-and-delete atomically: the lock is only deleted if the token matches, preventing a slow request from releasing a lock acquired by a later request.

---

## How Expiry Works in Production

Reservations have an `expiresAt` timestamp. Unreleased expired reservations must be cleaned up so their stock returns to available inventory.

### Two-pronged approach

#### 1. Vercel Cron Job (proactive)

`vercel.json` defines a cron that calls `GET /api/cron/expire-reservations` every minute. The endpoint is protected by a `CRON_SECRET` bearer token set in both the Vercel environment and your `.env`.

The handler calls `releaseExpiredReservations()` which:

1. Finds all `PENDING` reservations where `expiresAt < now()`
2. For each, atomically:
   - Sets `status = RELEASED`
   - Decrements `stock.reserved`

#### 2. Lazy cleanup on reads (defensive)

Every call to `GET /api/products` also calls `releaseExpiredReservations()` before returning stock levels. This ensures that even if the cron is delayed or the Vercel free tier limits background execution, available counts shown to users are always accurate.

### Why not a long-running background worker?

Vercel's serverless model doesn't support persistent background processes. A Vercel Cron + lazy cleanup gives us near-real-time accuracy without needing a separate worker process (which would require a VPS or a job queue like BullMQ/Inngest).

---

## Idempotency (Bonus)

The `POST /api/reservations` and `POST /api/reservations/:id/confirm` endpoints support idempotency via an `Idempotency-Key` header.

### How it works

1. If the request includes `Idempotency-Key: <some-uuid>`, the handler calls `withIdempotency(req, handler)`.
2. We look up the key in the `IdempotencyKey` table.
   - **Found:** return the stored `responseBody` and `statusCode` immediately — no side effect is repeated.
   - **Not found:** run the real handler, store `{ key, responseBody, statusCode }`, return the response.
3. On concurrent duplicates, the unique constraint on `key` means only one insert wins; the other is silently swallowed (`catch` on `P2002`).

### Storage

Idempotency records are stored in Postgres alongside reservations. An optional cron or TTL-based cleanup could prune records older than 24h, but is omitted here for simplicity.

### Client usage

```http
POST /api/reservations
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{ "productId": "...", "warehouseId": "...", "quantity": 1 }
```

---

## API Reference

| Method | Path | Status codes | Description |
|--------|------|-------------|-------------|
| `GET` | `/api/products` | 200 | List products with per-warehouse available stock |
| `GET` | `/api/warehouses` | 200 | List all warehouses |
| `POST` | `/api/reservations` | 201, 400, 409, 503 | Reserve units. 409 = not enough stock. 503 = lock contention, retry. |
| `GET` | `/api/reservations/:id` | 200, 404 | Get a single reservation |
| `POST` | `/api/reservations/:id/confirm` | 200, 410 | Confirm reservation. 410 = expired |
| `POST` | `/api/reservations/:id/release` | 200 | Release reservation early (idempotent) |
| `GET` | `/api/cron/expire-reservations` | 200, 401 | Cron endpoint — requires `Authorization: Bearer <CRON_SECRET>` |

---

## Trade-offs & Future Work

### What I'd do differently with more time

**Optimistic locking / SELECT FOR UPDATE**
For very high throughput, a `SELECT ... FOR UPDATE` inside a Postgres transaction (via Prisma's `$queryRaw`) is faster than a Redis round-trip. The Redis lock approach I used is simpler to reason about and works across databases, but adds ~1–2ms of network latency per reservation.

**Retry logic on the client**
When the server returns 503 (lock contention), the UI currently shows an error. A better UX would be to auto-retry with exponential back-off 2–3 times before surfacing the error.

**Authentication**
Reservations are not tied to a user identity. In production you'd attach `userId` to the reservation and verify ownership before confirming or releasing.

**Stock multi-warehouse fulfillment**
The current model assumes the user picks a specific warehouse. A real platform would select the nearest/cheapest warehouse automatically and may split an order across warehouses.

**Idempotency key TTL**
Idempotency records currently live forever. A nightly cleanup job should prune records older than 24 hours.

**Tests**
I focused on correctness of the concurrency logic rather than test coverage. The most valuable tests would be:
- A concurrent integration test that fires N simultaneous reserve requests for a stock of 1 and asserts exactly 1 succeeds.
- Unit tests for `releaseExpiredReservations`.

### Known limitations

- The Vercel Cron free tier runs at most once per minute, so a reservation can remain in PENDING state up to ~60 seconds after it expires — the lazy cleanup on product list reads mitigates this.
- `ioredis` will throw on startup if `REDIS_URL` is not set; add a fallback if you want to run without Redis (at the cost of losing the distributed lock).
