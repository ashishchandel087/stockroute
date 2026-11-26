import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  orderLines,
  orders,
  payments,
  products,
  retailerPrices,
  retailers,
  retailerTypes,
  typePrices,
  users,
} from "@/lib/db/schema";
import { getBalance, getBalances } from "@/lib/ledger";
import { buildPriceTables, resolvePrice } from "@/lib/pricing";
import { cancelOrder, DomainError, paymentStatusFor } from "@/lib/orders";
import { money } from "@/lib/format";
import type { CurrentUser } from "@/lib/auth";
import type {
  Catalog,
  OrderLineInput,
  OutboxItem,
  OutboxOrder,
  OutboxOrderCancel,
  OutboxOrderEdit,
  OutboxPayment,
  OutboxRetailer,
  ShopAccount,
  ShopFields,
  SyncResult,
} from "@/lib/sync-types";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LINES = 300;
const MAX_PHOTO_CHARS = 600_000; // ~450 KB JPEG

type Retailer = typeof retailers.$inferSelect;

// ======================================================================= catalog
/** Everything the phone needs to work offline. */
export async function buildCatalog(user: CurrentUser): Promise<Catalog> {
  const [prods, rets, types, tps, rps, balances, mine] = await Promise.all([
    db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        brand: products.brand,
        category: products.category,
        unit: products.unit,
        caseSize: products.caseSize,
        mrp: products.mrp,
        basePrice: products.basePrice,
      })
      .from(products)
      .where(eq(products.active, true))
      .orderBy(asc(products.name)),
    db
      .select({
        id: retailers.id,
        name: retailers.name,
        ownerName: retailers.ownerName,
        phone: retailers.phone,
        area: retailers.area,
        address: retailers.address,
        typeId: retailers.typeId,
        creditLimit: retailers.creditLimit,
        creditDays: retailers.creditDays,
        status: retailers.status,
        lat: retailers.lat,
        lng: retailers.lng,
        hasPhoto: sql<boolean>`${retailers.photo} is not null`,
      })
      .from(retailers)
      .where(ne(retailers.status, "inactive"))
      .orderBy(asc(retailers.name)),
    db.select({ id: retailerTypes.id, name: retailerTypes.name }).from(retailerTypes).orderBy(asc(retailerTypes.name)),
    db.select({ productId: typePrices.productId, typeId: typePrices.typeId, price: typePrices.price }).from(typePrices),
    db
      .select({ productId: retailerPrices.productId, retailerId: retailerPrices.retailerId, price: retailerPrices.price })
      .from(retailerPrices),
    getBalances(),
    db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        retailerId: orders.retailerId,
        retailerName: retailers.name,
        status: orders.status,
        total: orders.total,
        deliveredTotal: orders.deliveredTotal,
        bookedAt: orders.bookedAt,
        notes: orders.notes,
      })
      .from(orders)
      .innerJoin(retailers, eq(retailers.id, orders.retailerId))
      .where(eq(orders.salesmanId, user.id))
      .orderBy(desc(orders.orderNo))
      .limit(100),
  ]);

  const lines = await linesFor(mine.map((o) => o.id));

  return {
    user: { id: user.id, name: user.name, role: user.role },
    serverTime: new Date().toISOString(),
    products: prods,
    retailers: rets.map((r) => {
      const b = balances.get(r.id);
      return {
        ...r,
        status: r.status === "pending" ? "pending" : "active",
        hasPhoto: Boolean(r.hasPhoto),
        outstanding: b?.outstanding ?? 0,
        overdue: b?.overdue ?? 0,
        openOrders: b?.openOrders ?? 0,
      };
    }),
    types,
    typePrices: tps,
    retailerPrices: rps,
    myOrders: mine.map((o) => {
      const ls = lines.get(o.id) ?? [];
      return { ...o, bookedAt: o.bookedAt.toISOString(), items: ls.length, lines: ls };
    }),
  };
}

async function linesFor(orderIds: string[]) {
  const map = new Map<string, OrderLineInput[]>();
  if (!orderIds.length) return map;
  const rows = await db
    .select({ orderId: orderLines.orderId, productId: orderLines.productId, qty: orderLines.qty, price: orderLines.price })
    .from(orderLines)
    .where(inArray(orderLines.orderId, orderIds));
  for (const r of rows) {
    const list = map.get(r.orderId) ?? [];
    list.push({ productId: r.productId, qty: r.qty, price: r.price });
    map.set(r.orderId, list);
  }
  return map;
}

// ======================================================================= orders (shared)
/**
 * Validates lines, re-prices them on the server, and runs the credit check.
 * The client's price is kept (it's what the retailer was told) but differences are flagged.
 * `clientPrices=false` (office orders) always uses the server price.
 */
export async function prepareOrder(
  retailer: Retailer,
  rawLines: OrderLineInput[],
  opts: { excludeOrderId?: string; clientPrices?: boolean } = {},
) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) throw new DomainError("Order has no items");
  if (rawLines.length > MAX_LINES) throw new DomainError("Too many items in one order");

  const merged = new Map<string, { qty: number; price: number | null }>();
  for (const l of rawLines) {
    const qty = Math.floor(Number(l.qty));
    if (!l.productId || !Number.isFinite(qty) || qty <= 0) throw new DomainError("Invalid quantity");
    const price = opts.clientPrices === false ? null : Math.round(Number(l.price));
    if (price != null && (!Number.isFinite(price) || price < 0)) throw new DomainError("Invalid price");
    const prev = merged.get(String(l.productId));
    merged.set(String(l.productId), { qty: (prev?.qty ?? 0) + qty, price });
  }

  const ids = [...merged.keys()];
  const [prods, tps, rps] = await Promise.all([
    db.select().from(products).where(inArray(products.id, ids)),
    db.select().from(typePrices).where(inArray(typePrices.productId, ids)),
    db.select().from(retailerPrices).where(and(inArray(retailerPrices.productId, ids), eq(retailerPrices.retailerId, retailer.id))),
  ]);
  if (prods.length !== ids.length) throw new DomainError("Some products no longer exist");
  const tables = buildPriceTables(tps, rps);

  let priceChanged = 0;
  const lines = prods.map((p) => {
    const m = merged.get(p.id)!;
    const server = resolvePrice(p, retailer, tables);
    const price = m.price ?? server.price;
    if (price !== server.price) priceChanged++;
    return { productId: p.id, qty: m.qty, price, priceSource: server.source };
  });
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  const notes: string[] = [];
  if (retailer.status === "pending") {
    notes.push("New shop added by salesman: approve the shop first");
  } else {
    const bal = await getBalance(retailer.id);
    let open = bal.openOrders;
    if (opts.excludeOrderId) {
      const [prev] = await db.select({ total: orders.total }).from(orders).where(eq(orders.id, opts.excludeOrderId));
      open -= prev?.total ?? 0;
    }
    if (retailer.creditLimit != null && bal.outstanding + open + total > retailer.creditLimit) {
      notes.push(`Exposure ${money(bal.outstanding + open + total)} exceeds credit limit ${money(retailer.creditLimit)}`);
    }
    if (bal.overdue > 0) notes.push(`Overdue dues ${money(bal.overdue)}`);
  }

  return { lines, total, priceFlag: priceChanged > 0, creditFlag: notes.length > 0, flagNote: notes.join(" · ") || null };
}

/** Creates a booked order. Idempotent on `id`. Returns the order number. */
export async function createOrder(input: {
  id: string;
  retailerId: string;
  bookedBy: string;
  bookedAt?: Date;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
  lines: OrderLineInput[];
  clientPrices?: boolean;
}): Promise<number> {
  const [existing] = await db.select({ orderNo: orders.orderNo, salesmanId: orders.salesmanId }).from(orders).where(eq(orders.id, input.id));
  if (existing) {
    if (existing.salesmanId !== input.bookedBy) throw new DomainError("Order id conflict");
    return existing.orderNo;
  }
  const [retailer] = await db.select().from(retailers).where(eq(retailers.id, input.retailerId));
  if (!retailer || retailer.status === "inactive") throw new DomainError("Shop not found or inactive");

  const prep = await prepareOrder(retailer, input.lines, { clientPrices: input.clientPrices });
  const lat = typeof input.lat === "number" && Number.isFinite(input.lat) ? input.lat : null;
  const lng = typeof input.lng === "number" && Number.isFinite(input.lng) ? input.lng : null;
  const bookedAt = input.bookedAt && !Number.isNaN(input.bookedAt.getTime()) ? input.bookedAt : new Date();

  const orderNo = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(orders)
      .values({
        id: input.id,
        retailerId: retailer.id,
        salesmanId: input.bookedBy,
        warehouseId: retailer.defaultWarehouseId,
        status: "booked",
        creditFlag: prep.creditFlag,
        priceFlag: prep.priceFlag,
        flagNote: prep.flagNote,
        notes: input.notes?.toString().slice(0, 500) || null,
        lat,
        lng,
        total: prep.total,
        bookedAt,
      })
      .onConflictDoNothing()
      .returning({ orderNo: orders.orderNo });
    if (!row) return null;
    await tx.insert(orderLines).values(prep.lines.map((l) => ({ ...l, orderId: input.id })));
    return row.orderNo;
  });
  if (orderNo != null) return orderNo;
  const [again] = await db.select({ orderNo: orders.orderNo }).from(orders).where(eq(orders.id, input.id));
  return again.orderNo;
}

/** Replaces the items of an order that is still waiting for approval. */
export async function editBookedOrder(
  user: { id: string; role: string },
  input: { orderId: string; lines: OrderLineInput[]; notes: string | null; clientPrices?: boolean },
) {
  const [o] = await db.select().from(orders).where(eq(orders.id, input.orderId));
  if (!o) throw new DomainError("Order not found");
  if (user.role !== "admin" && o.salesmanId !== user.id) throw new DomainError("You can only change your own orders");
  if (o.status !== "booked") throw new DomainError(`Order #${o.orderNo} is already ${o.status.replace("_", " ")}; it can't be changed`);
  const [retailer] = await db.select().from(retailers).where(eq(retailers.id, o.retailerId));
  const prep = await prepareOrder(retailer, input.lines, { excludeOrderId: o.id, clientPrices: input.clientPrices });

  await db.transaction(async (tx) => {
    const [locked] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, o.id)).for("update");
    if (locked.status !== "booked") throw new DomainError(`Order #${o.orderNo} was just approved; it can't be changed`);
    await tx.delete(orderLines).where(eq(orderLines.orderId, o.id));
    await tx.insert(orderLines).values(prep.lines.map((l) => ({ ...l, orderId: o.id })));
    await tx
      .update(orders)
      .set({
        total: prep.total,
        creditFlag: prep.creditFlag,
        priceFlag: prep.priceFlag,
        flagNote: prep.flagNote,
        notes: input.notes?.toString().slice(0, 500) || null,
        editedAt: new Date(),
      })
      .where(eq(orders.id, o.id));
  });
  return o.orderNo;
}

// ======================================================================= shops
function cleanShopFields(f: ShopFields) {
  const s = (v: unknown, max = 200) => {
    const t = (v ?? "").toString().trim().slice(0, max);
    return t || null;
  };
  const name = s(f.name, 120);
  if (!name) throw new DomainError("Shop name is required");
  let photo: string | null | undefined = undefined;
  if (f.photo === null) photo = null;
  else if (typeof f.photo === "string") {
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(f.photo)) throw new DomainError("Photo must be an image");
    if (f.photo.length > MAX_PHOTO_CHARS) throw new DomainError("Photo is too large");
    photo = f.photo;
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    name,
    ownerName: s(f.ownerName),
    phone: s(f.phone, 20),
    address: s(f.address, 300),
    area: s(f.area, 80),
    typeId: s(f.typeId, 64),
    lat: num(f.lat),
    lng: num(f.lng),
    photo,
  };
}

/** Salesman adds a shop (status pending until admin approves) or edits shop details. */
export async function upsertShopFromField(user: { id: string; role: string }, op: OutboxRetailer) {
  if (!UUID.test(op.retailerId)) throw new DomainError("Bad shop id");
  const f = cleanShopFields(op.fields);
  if (f.typeId) {
    const [t] = await db.select({ id: retailerTypes.id }).from(retailerTypes).where(eq(retailerTypes.id, f.typeId));
    if (!t) f.typeId = null;
  }
  const [existing] = await db.select().from(retailers).where(eq(retailers.id, op.retailerId));
  const photo = f.photo === undefined ? {} : { photo: f.photo };

  if (op.mode === "create" && !existing) {
    // Supply warehouse defaults to the first active one; admin sets credit terms on approval
    const [wh] = await db.execute<{ id: string }>(sql`select id from warehouses where active order by name limit 1`).then((r) => r.rows);
    await db
      .insert(retailers)
      .values({
        id: op.retailerId,
        name: f.name,
        ownerName: f.ownerName,
        phone: f.phone,
        address: f.address,
        area: f.area,
        typeId: f.typeId,
        lat: f.lat,
        lng: f.lng,
        ...photo,
        defaultWarehouseId: wh?.id ?? null,
        creditLimit: 0,
        status: user.role === "admin" ? "active" : "pending",
        createdBy: user.id,
      })
      .onConflictDoNothing();
    return;
  }
  if (!existing) throw new DomainError("Shop not found");
  if (existing.status === "inactive") throw new DomainError("This shop has been closed by the office");
  // Field staff can't change the retailer type (it changes prices) once the shop is approved
  const typeId = existing.status === "pending" || user.role === "admin" ? f.typeId : existing.typeId;
  await db
    .update(retailers)
    .set({
      name: f.name,
      ownerName: f.ownerName,
      phone: f.phone,
      address: f.address,
      area: f.area,
      typeId,
      lat: f.lat ?? existing.lat,
      lng: f.lng ?? existing.lng,
      ...photo,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(retailers.id, existing.id));
}

/** Bills, payments and recent orders of one shop, for the app. */
export async function getShopAccount(retailerId: string): Promise<ShopAccount | null> {
  const [r] = await db
    .select({ id: retailers.id, photo: retailers.photo, openingBalance: retailers.openingBalance, createdAt: retailers.createdAt })
    .from(retailers)
    .where(eq(retailers.id, retailerId));
  if (!r) return null;
  const [bal, bills, pays, recent] = await Promise.all([
    getBalance(retailerId),
    db
      .select({ orderNo: orders.orderNo, at: orders.deliveredAt, amount: orders.deliveredTotal })
      .from(orders)
      .where(and(eq(orders.retailerId, retailerId), inArray(orders.status, ["delivered", "partially_delivered"])))
      .orderBy(desc(orders.deliveredAt))
      .limit(50),
    db
      .select({ at: payments.collectedAt, amount: payments.amount, mode: payments.mode })
      .from(payments)
      .where(eq(payments.retailerId, retailerId))
      .orderBy(desc(payments.collectedAt))
      .limit(50),
    db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        status: orders.status,
        total: orders.total,
        deliveredTotal: orders.deliveredTotal,
        bookedAt: orders.bookedAt,
        bookedBy: users.name,
      })
      .from(orders)
      .innerJoin(users, eq(users.id, orders.salesmanId))
      .where(eq(orders.retailerId, retailerId))
      .orderBy(desc(orders.orderNo))
      .limit(10),
  ]);
  const lines = await linesFor(recent.map((o) => o.id));
  const entries: ShopAccount["entries"] = [
    ...bills.map((b) => ({ at: (b.at ?? new Date(0)).toISOString(), kind: "bill" as const, amount: b.amount ?? 0, label: `Bill · order #${b.orderNo}` })),
    ...pays.map((p) => ({ at: p.at.toISOString(), kind: "payment" as const, amount: p.amount, label: `Payment · ${p.mode.toUpperCase()}` })),
  ];
  if (r.openingBalance) entries.push({ at: r.createdAt.toISOString(), kind: "opening", amount: r.openingBalance, label: "Opening balance" });
  entries.sort((a, b) => b.at.localeCompare(a.at));
  return {
    retailerId,
    photo: r.photo,
    outstanding: bal.outstanding,
    overdue: bal.overdue,
    openOrders: bal.openOrders,
    entries: entries.slice(0, 40),
    orders: recent.map((o) => ({ ...o, bookedAt: o.bookedAt.toISOString(), lines: lines.get(o.id) ?? [] })),
    fetchedAt: new Date().toISOString(),
  };
}

// ======================================================================= sync ingest
async function ingestPayment(user: CurrentUser, p: OutboxPayment) {
  const amount = Math.round(Number(p.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw new DomainError("Invalid amount");
  if (!["cash", "upi", "cheque", "bank"].includes(p.mode)) throw new DomainError("Invalid mode");
  const [retailer] = await db.select({ id: retailers.id }).from(retailers).where(eq(retailers.id, String(p.retailerId)));
  if (!retailer) throw new DomainError("Shop not found");
  const at = new Date(p.collectedAt);
  await db
    .insert(payments)
    .values({
      id: p.id,
      retailerId: retailer.id,
      amount,
      mode: p.mode,
      reference: p.reference?.toString().slice(0, 100) || null,
      notes: p.notes?.toString().slice(0, 300) || null,
      collectedBy: user.id,
      collectedAt: Number.isNaN(at.getTime()) ? new Date() : at,
      status: paymentStatusFor(p.mode, user.role === "admin"),
    })
    .onConflictDoNothing();
}

async function ingestOrderCancel(user: CurrentUser, c: OutboxOrderCancel) {
  const [o] = await db.select().from(orders).where(eq(orders.id, c.orderId));
  if (!o) throw new DomainError("Order not found");
  if (o.status === "cancelled") return; // already done (retry)
  if (user.role !== "admin" && o.salesmanId !== user.id) throw new DomainError("You can only cancel your own orders");
  if (o.status !== "booked") throw new DomainError(`Order #${o.orderNo} is already ${o.status.replace("_", " ")}; ask the office to cancel`);
  await cancelOrder({ orderId: o.id, reason: `By salesman: ${c.reason || "no reason given"}`, userId: user.id });
}

/** Applies one item from the phone's outbox. Never throws: returns ok/error per item. */
export async function ingestItem(user: CurrentUser, item: OutboxItem): Promise<SyncResult> {
  const id = String(item?.id ?? "");
  if (!UUID.test(id)) return { id, ok: false, error: "Bad id" };
  try {
    switch (item.kind) {
      case "retailer":
        await upsertShopFromField(user, item);
        return { id, ok: true };
      case "order": {
        const o = item as OutboxOrder;
        const orderNo = await createOrder({
          id: o.id,
          retailerId: String(o.retailerId),
          bookedBy: user.id,
          bookedAt: new Date(o.bookedAt),
          lat: o.lat,
          lng: o.lng,
          notes: o.notes,
          lines: o.lines,
        });
        return { id, ok: true, orderNo };
      }
      case "orderEdit": {
        const e = item as OutboxOrderEdit;
        const orderNo = await editBookedOrder(user, { orderId: String(e.orderId), lines: e.lines, notes: e.notes });
        return { id, ok: true, orderNo };
      }
      case "orderCancel":
        await ingestOrderCancel(user, item);
        return { id, ok: true };
      case "payment":
        await ingestPayment(user, item);
        return { id, ok: true };
      default:
        return { id, ok: false, error: "Unknown item" };
    }
  } catch (e) {
    if (e instanceof DomainError) return { id, ok: false, error: e.message };
    console.error("sync item failed", e);
    return { id, ok: false, error: "Server error, will retry" };
  }
}
