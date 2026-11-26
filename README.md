# StockRoute

Order booking and inventory for a distributor. Salesmen visit retailers and book orders on their phones, even with no internet. The office approves orders, the warehouse packs and dispatches them, and delivery staff deliver and collect payment.

## Quick start (your Neon database)

`.env.local` (git-ignored) holds `DATABASE_URL` (Neon, pooled), `DATABASE_URL_UNPOOLED` (direct, used for migrations) and `SESSION_SECRET`.

```bash
npm install
npm run db:setup     # creates/updates tables on Neon. Never adds data.
npm run dev          # http://localhost:3000
```

Sign in with the admin login. The dashboard's *Getting started* list walks you through adding retailer types, products, opening stock, retailers and staff (*Users*).

### Trying the app with demo data (local only)

Without `DATABASE_URL`, the app uses a local embedded database (`.data/pglite`). `npm run db:reset` fills it with demo data; it ignores `.env.local`, so it never touches Neon. To run the app on the demo data, comment out `DATABASE_URL` in `.env.local`. Demo logins (from `scripts/seed.ts`):

| Role      | Mobile     | PIN  | Opens        |
|-----------|------------|------|--------------|
| Admin     | 9000000001 | 1234 | `/admin`     |
| Salesman  | 9000000002 | 1111 | `/sales`     |
| Salesman  | 9000000005 | 1111 | `/sales`     |
| Warehouse | 9000000003 | 2222 | `/warehouse` |
| Delivery  | 9000000004 | 3333 | `/delivery`  |

## How it works

```
Salesman (phone, offline OK)      Admin                 Warehouse            Delivery
  book order ──► Booked ──approve──► Approved ──pack──► Packed ──dispatch──► Out for delivery ──deliver──► Delivered / Part delivered
                                    (stock reserved)    (batches picked,     (stock deducted)               (bill added to retailer ledger,
                                                         earliest expiry 1st)                               undelivered qty back to stock)
```

- **Prices** are applied in layers, and the most specific one wins: retailer's special price → retailer-type price → base price.
- **Credit check.** An order is flagged for the admin when the retailer's outstanding dues plus orders in progress plus the new order exceed the credit limit, or when the retailer has overdue dues. A flagged order is still booked.
- **Overdue** uses first-in, first-out: payments clear the oldest bills first, and any bill older than the retailer's credit days is overdue.
- **Stock** is tracked per product, warehouse and batch (with expiry). Reserved stock = approved orders not yet dispatched. Every change is logged in *Stock → Movements*.
- **Cash and cheques** collected in the field show as *with staff* until the admin confirms the handover (*Payments → Cash with staff*).

### One app for everyone

Install it once on any phone (Chrome → ⋮ → *Add to Home screen*). It opens on each person's own home screen. Admin, warehouse and delivery get bottom tabs on phones, with a *More* sheet for the rest of the menu.

**Salesman app (`/sales`, works offline):**

| Tab | What a salesman can do |
|-----|------------------------|
| Shops | Search and filter shops by area or *New shops*. **Add a shop** with owner, phone, area, type, GPS location and a shop photo. **Edit** shop details (only the office can change the type of an approved shop). |
| Shop page | Dues and overdue amounts. New order, collect a payment, **repeat the last order** in one tap. **Orders** and **Bills & payments** history (saved for offline viewing). |
| Orders | All orders, including ones not uploaded yet. **Change items** or **cancel** an order until the office approves it. Order the same again. |
| Products | Full catalogue with prices for any shop type. **Share the price list** on WhatsApp. |
| Account | Today's orders and value, sync status, log out. |

A new shop can take orders straight away. The shop shows as *New* until the office approves it; its orders can't be approved before then.

**Office (admin):**
- **New shops:** a banner on the dashboard. On the shop's page, set its type, supply warehouse and credit terms, then *Approve*. Or *Reject*, which also cancels its waiting orders.
- **New order** (*Orders → New order*): book an order for any shop, e.g. when a retailer phones in. It uses that shop's prices and can be booked on behalf of a salesman.

### How offline works

`/sales` is a static page cached by a service worker (`public/sw.js`). Products, prices, shops, dues and my orders are stored on the phone in IndexedDB. New shops, shop edits, orders, order changes, cancellations and payments are saved on the phone first, then uploaded by `/api/sales/sync` in the order they were made, so a new shop is created before the order placed for it. Every item has an ID made on the phone, so retries never create duplicates. The server re-checks prices and credit when an order arrives. Office screens need internet; offline they show a friendly *You are offline* page.

Offline caching only works in a production build (`npm run build && npm start`) over HTTPS, or on localhost. Order numbers can skip values (a normal Postgres behaviour after a restart); they never repeat.

## Database

- **Neon (real data):** `DATABASE_URL` in `.env.local`. `npm run db:setup` applies migrations (via `DATABASE_URL_UNPOOLED`) and never inserts data; `npm run db:setup -- --seed` would add demo data, so don't use it on your real database.
- **Local demo:** with no `DATABASE_URL`, the app uses **PGlite** (embedded Postgres in `.data/pglite`). Only one process can open it at a time, and the server should be stopped with Ctrl+C. If it's ever damaged, `npm run db:reset` rebuilds it with demo data.
- **Schema changes:** edit `src/lib/db/schema.ts`, run `npm run db:generate`, then run `npm run db:setup`.
- **Slow networks:** Node gives up on a server address after 250 ms by default, which is too short from India to Neon's US region. The app allows 2.5 s (`src/lib/db/client.ts`). For one-off `node` scripts, add `--network-family-autoselection-attempt-timeout=3000`.

## Deploying (e.g. Vercel + Neon)

1. On your hosting provider, set `DATABASE_URL` (Neon pooled URL) and `SESSION_SECRET` (the same value as in `.env.local`, or a new `openssl rand -hex 32`; changing it logs everyone out).
2. Run `npm run db:setup` from your machine whenever there are new migrations.
3. Deploy. The live site uses the same users as your Neon database.
4. The site must be served over HTTPS for the phone app to install and work offline.

## Project map

| Path | What |
|------|------|
| `src/lib/db/schema.ts` | All tables (money in paise, quantities in pieces) |
| `src/lib/orders.ts` | Order lifecycle: approve / pack / dispatch / deliver / cancel (transactions with row locks) |
| `src/lib/ledger.ts` | Retailer outstanding, overdue, open orders |
| `src/lib/stock.ts` | On hand / reserved / available |
| `src/lib/pricing.ts` | Layered price resolution (shared by phone and server) |
| `src/lib/sync.ts` | Catalog download and idempotent order/payment upload |
| `src/app/sales/` | Offline salesman app (Dexie storage, sync engine, UI) |
| `src/app/admin/` | Admin screens and server actions |
| `src/app/warehouse/`, `src/app/delivery/` | Warehouse and delivery screens |
| `src/proxy.ts` | Sends each role to its own area |

## Roadmap

- **Done:** new shops from the field (with approval), edit/cancel orders before approval, shop history and repeat order, price list sharing, office orders, one app for all roles.
- **Phase 2:** schemes and discounts, visits with GPS (and "no order" reasons), smarter reorder suggestions, targets, returns.
- **Phase 3:** reports dashboard; Tally import (items, ledgers, opening balances, receipts) and export (sales vouchers).
