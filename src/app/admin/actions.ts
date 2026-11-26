"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  batches,
  orderLines,
  orders,
  payments,
  products,
  purchaseLines,
  purchases,
  retailerPrices,
  retailers,
  retailerTypes,
  stockMovements,
  suppliers,
  typePrices,
  users,
  warehouses,
  type PaymentMode,
  type Role,
} from "@/lib/db/schema";
import { toPaise } from "@/lib/format";
import type { ActionResult } from "@/components/form-bits";
import { cancelOrder, DomainError } from "@/lib/orders";
import { createOrder, prepareOrder } from "@/lib/sync";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optStr = (f: FormData, k: string) => str(f, k) || null;
const int = (f: FormData, k: string, d = 0) => {
  const n = parseInt(str(f, k), 10);
  return Number.isFinite(n) ? n : d;
};
function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

// ======================================================= Products
export async function saveProduct(_p: ActionResult, f: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const id = str(f, "id");
  const values = {
    sku: str(f, "sku").toUpperCase(),
    name: str(f, "name"),
    brand: optStr(f, "brand"),
    category: optStr(f, "category"),
    unit: str(f, "unit") || "pc",
    caseSize: Math.max(1, int(f, "caseSize", 1)),
    mrp: toPaise(f.get("mrp")) ?? 0,
    basePrice: toPaise(f.get("basePrice")) ?? -1,
    active: f.get("active") === "on",
  };
  if (!values.sku || !values.name) return { error: "SKU and name are required." };
  if (values.basePrice < 0) return { error: "Enter the base selling price." };

  // Retailer-type prices: fields tp_<typeId>; blank = use base price
  const typeRows: { typeId: string; price: number }[] = [];
  for (const [k, v] of f.entries()) {
    if (!k.startsWith("tp_")) continue;
    const price = toPaise(v as string);
    if (price != null) typeRows.push({ typeId: k.slice(3), price });
  }

  let productId = id;
  try {
    await db.transaction(async (tx) => {
      if (id) {
        await tx.update(products).set(values).where(eq(products.id, id));
      } else {
        const [p] = await tx.insert(products).values(values).returning({ id: products.id });
        productId = p.id;
      }
      await tx.delete(typePrices).where(eq(typePrices.productId, productId));
      if (typeRows.length) {
        await tx.insert(typePrices).values(typeRows.map((r) => ({ ...r, productId })));
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `SKU "${values.sku}" is already used by another product.` };
    throw e;
  }
  if (!id) redirect("/admin/products?saved=1");
  refresh();
  return { ok: true, message: "Product saved." };
}

// ======================================================= Retailers
export async function saveRetailer(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  const id = str(f, "id");
  const creditLimitRaw = str(f, "creditLimit");
  const values = {
    name: str(f, "name"),
    ownerName: optStr(f, "ownerName"),
    phone: optStr(f, "phone"),
    address: optStr(f, "address"),
    area: optStr(f, "area"),
    gstin: optStr(f, "gstin")?.toUpperCase() ?? null,
    typeId: optStr(f, "typeId"),
    defaultWarehouseId: optStr(f, "defaultWarehouseId"),
    creditLimit: creditLimitRaw === "" ? null : toPaise(creditLimitRaw),
    creditDays: Math.max(0, int(f, "creditDays", 15)),
    openingBalance: toPaise(f.get("openingBalance")) ?? 0,
    status: (str(f, "status") || "active") as "active" | "pending" | "inactive",
  };
  if (!values.name) return { error: "Shop name is required." };
  if (id) {
    await db.update(retailers).set(values).where(eq(retailers.id, id));
    refresh();
    return { ok: true, message: "Retailer saved." };
  }
  const [r] = await db.insert(retailers).values({ ...values, createdBy: user.id }).returning({ id: retailers.id });
  redirect(`/admin/retailers/${r.id}?saved=1`);
}

export async function setRetailerPrice(_p: ActionResult, f: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const retailerId = str(f, "retailerId");
  const productId = str(f, "productId");
  const price = toPaise(f.get("price"));
  if (!productId) return { error: "Choose a product." };
  if (price == null || price < 0) return { error: "Enter the special price." };
  await db
    .insert(retailerPrices)
    .values({ retailerId, productId, price })
    .onConflictDoUpdate({ target: [retailerPrices.productId, retailerPrices.retailerId], set: { price } });
  refresh();
  return { ok: true, message: "Special price saved." };
}

export async function removeRetailerPrice(f: FormData) {
  await requireRole("admin");
  await db.delete(retailerPrices).where(eq(retailerPrices.id, str(f, "id")));
  refresh();
}

// ======================================================= Staff
export async function saveUser(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const me = await requireRole("admin");
  const id = str(f, "id");
  const phone = str(f, "phone").replace(/\D/g, "").slice(-10);
  const pin = str(f, "pin");
  const role = str(f, "role") as Role;
  const active = f.get("active") === "on";
  const name = str(f, "name");
  if (!name) return { error: "Name is required." };
  if (phone.length !== 10) return { error: "Enter a 10-digit mobile number." };
  if (!["admin", "salesman", "warehouse", "delivery"].includes(role)) return { error: "Choose a role." };
  if (pin && !/^\d{4,6}$/.test(pin)) return { error: "PIN must be 4 to 6 digits." };
  if (!id && !pin) return { error: "Set a PIN for the new staff member." };
  if (id === me.id && (!active || role !== "admin")) return { error: "You can't remove your own admin access." };

  const values = {
    name,
    phone,
    role,
    active,
    ...(pin ? { pinHash: await bcrypt.hash(pin, 10), failedAttempts: 0, lockedUntil: null } : {}),
  };
  try {
    if (id) await db.update(users).set(values).where(eq(users.id, id));
    else await db.insert(users).values({ ...values, pinHash: values.pinHash! });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Another staff member already uses this mobile number." };
    throw e;
  }
  refresh();
  return { ok: true, message: id ? (pin ? "Saved and PIN reset." : "Saved.") : `${name} added. They can log in now.` };
}

// ======================================================= Settings
export async function saveWarehouse(_p: ActionResult, f: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const id = str(f, "id");
  const name = str(f, "name");
  if (!name) return { error: "Name is required." };
  const values = { name, address: optStr(f, "address"), active: id ? f.get("active") === "on" : true };
  try {
    if (id) await db.update(warehouses).set(values).where(eq(warehouses.id, id));
    else await db.insert(warehouses).values(values);
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "A warehouse with this name exists." };
    throw e;
  }
  refresh();
  return { ok: true, message: "Warehouse saved." };
}

export async function saveRetailerType(_p: ActionResult, f: FormData): Promise<ActionResult> {
  await requireRole("admin");
  const id = str(f, "id");
  const name = str(f, "name");
  if (!name) return { error: "Name is required." };
  try {
    if (id) await db.update(retailerTypes).set({ name }).where(eq(retailerTypes.id, id));
    else await db.insert(retailerTypes).values({ name });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "This type already exists." };
    throw e;
  }
  refresh();
  return { ok: true, message: "Saved." };
}

// ======================================================= Purchases
type PurchaseLineInput = { productId: string; batchNo: string; expiry: string | null; qty: number; rate: number };

export async function createPurchase(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  const supplierName = str(f, "supplier");
  const warehouseId = str(f, "warehouseId");
  let lines: PurchaseLineInput[];
  try {
    lines = JSON.parse(str(f, "lines") || "[]");
  } catch {
    return { error: "Could not read the items. Please try again." };
  }
  lines = lines.filter((l) => l.productId && l.qty > 0);
  if (!supplierName) return { error: "Enter the supplier name." };
  if (!warehouseId) return { error: "Choose the warehouse receiving the goods." };
  if (!lines.length) return { error: "Add at least one item with quantity." };
  for (const l of lines) {
    if (!l.batchNo?.trim()) return { error: "Every item needs a batch number (use the invoice no. if none)." };
    if (!Number.isInteger(l.qty) || l.qty <= 0) return { error: "Quantities must be whole pieces." };
    if (!Number.isInteger(l.rate) || l.rate < 0) return { error: "Check the purchase rates." };
  }

  const purchaseId = await db.transaction(async (tx) => {
    const [sup] = await tx
      .insert(suppliers)
      .values({ name: supplierName })
      .onConflictDoUpdate({ target: suppliers.name, set: { name: supplierName } })
      .returning();
    const total = lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const [pur] = await tx
      .insert(purchases)
      .values({
        supplierId: sup.id,
        warehouseId,
        invoiceNo: optStr(f, "invoiceNo"),
        invoiceDate: optStr(f, "invoiceDate"),
        notes: optStr(f, "notes"),
        total,
        createdBy: user.id,
      })
      .returning();
    for (const l of lines) {
      const batchNo = l.batchNo.trim().toUpperCase();
      const [b] = await tx
        .insert(batches)
        .values({ productId: l.productId, warehouseId, batchNo, expiry: l.expiry || null, qty: l.qty })
        .onConflictDoUpdate({
          target: [batches.productId, batches.warehouseId, batches.batchNo],
          set: {
            qty: sql`${batches.qty} + ${l.qty}`,
            ...(l.expiry ? { expiry: l.expiry } : {}),
          },
        })
        .returning();
      await tx.insert(purchaseLines).values({ purchaseId: pur.id, productId: l.productId, batchId: b.id, qty: l.qty, rate: l.rate });
      await tx.insert(stockMovements).values({
        productId: l.productId,
        warehouseId,
        batchId: b.id,
        qty: l.qty,
        kind: "purchase",
        refId: pur.id,
        note: `Purchase #${pur.purchaseNo} · ${supplierName}`,
        createdBy: user.id,
      });
    }
    return pur.id;
  });
  redirect(`/admin/purchases/${purchaseId}?saved=1`);
}

// ======================================================= Stock adjustment
export async function adjustStock(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  const productId = str(f, "productId");
  const warehouseId = str(f, "warehouseId");
  const batchNo = str(f, "batchNo").toUpperCase();
  const direction = str(f, "direction");
  const qty = int(f, "qty");
  const reason = str(f, "reason");
  if (!productId || !warehouseId) return { error: "Choose product and warehouse." };
  if (!batchNo) return { error: "Choose or type a batch." };
  if (qty <= 0) return { error: "Enter the quantity to add or remove." };
  if (!reason) return { error: "Give a reason (damaged, expired, count correction…)." };
  const delta = direction === "remove" ? -qty : qty;

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(batches)
        .where(and(eq(batches.productId, productId), eq(batches.warehouseId, warehouseId), eq(batches.batchNo, batchNo)))
        .for("update");
      if (!existing && delta < 0) throw new Error("NOBATCH");
      if (existing && existing.qty + delta < 0) throw new Error("NEG");
      const [b] = existing
        ? await tx
            .update(batches)
            .set({ qty: existing.qty + delta, ...(str(f, "expiry") ? { expiry: str(f, "expiry") } : {}) })
            .where(eq(batches.id, existing.id))
            .returning()
        : await tx
            .insert(batches)
            .values({ productId, warehouseId, batchNo, expiry: optStr(f, "expiry"), qty: delta })
            .returning();
      await tx.insert(stockMovements).values({
        productId,
        warehouseId,
        batchId: b.id,
        qty: delta,
        kind: "adjustment",
        note: reason,
        createdBy: user.id,
      });
    });
  } catch (e) {
    if ((e as Error).message === "NOBATCH") return { error: "That batch doesn't exist in this warehouse." };
    if ((e as Error).message === "NEG") return { error: "Can't remove more than the batch has." };
    throw e;
  }
  refresh();
  return { ok: true, message: "Stock updated." };
}

// ======================================================= Payments
export async function recordPayment(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  const retailerId = str(f, "retailerId");
  const amount = toPaise(f.get("amount"));
  const mode = str(f, "mode") as PaymentMode;
  if (!retailerId) return { error: "Choose the retailer." };
  if (!amount || amount <= 0) return { error: "Enter the amount received." };
  if (!["cash", "upi", "bank", "cheque"].includes(mode)) return { error: "Choose payment mode." };
  const date = str(f, "date");
  await db.insert(payments).values({
    id: crypto.randomUUID(),
    retailerId,
    amount,
    mode,
    reference: optStr(f, "reference"),
    notes: optStr(f, "notes"),
    collectedBy: user.id,
    collectedAt: date ? new Date(date + "T12:00:00") : new Date(),
    status: "received",
    receivedBy: user.id,
    receivedAt: new Date(),
  });
  refresh();
  return { ok: true, message: "Payment recorded." };
}

/** Confirm cash/cheques handed over by field staff. */
export async function markReceived(f: FormData) {
  const user = await requireRole("admin");
  const ids = f.getAll("paymentId").map(String).filter(Boolean);
  if (!ids.length) return;
  await db
    .update(payments)
    .set({ status: "received", receivedBy: user.id, receivedAt: new Date() })
    .where(and(inArray(payments.id, ids), ne(payments.status, "received")));
  refresh();
}

// ======================================================= New shops from the field
/** Approve a shop added by a salesman: set its terms and make it active. */
export async function approveShop(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  const id = str(f, "id");
  const creditLimitRaw = str(f, "creditLimit");
  const [shop] = await db.select().from(retailers).where(eq(retailers.id, id));
  if (!shop) return { error: "Shop not found." };
  await db
    .update(retailers)
    .set({
      status: "active",
      typeId: optStr(f, "typeId"),
      defaultWarehouseId: optStr(f, "defaultWarehouseId"),
      creditLimit: creditLimitRaw === "" ? null : toPaise(creditLimitRaw),
      creditDays: Math.max(0, int(f, "creditDays", 15)),
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .where(eq(retailers.id, id));

  // Orders booked while the shop was new: re-run the credit check with the real terms
  const [approved] = await db.select().from(retailers).where(eq(retailers.id, id));
  const waiting = await db.select().from(orders).where(and(eq(orders.retailerId, id), eq(orders.status, "booked")));
  for (const o of waiting) {
    const lines = await db.select().from(orderLines).where(eq(orderLines.orderId, o.id));
    const prep = await prepareOrder(approved, lines, { excludeOrderId: o.id });
    await db
      .update(orders)
      .set({ creditFlag: prep.creditFlag, flagNote: prep.flagNote, warehouseId: o.warehouseId ?? approved.defaultWarehouseId })
      .where(eq(orders.id, o.id));
  }
  refresh();
  return { ok: true, message: `Shop approved.${waiting.length ? ` ${waiting.length} order(s) are now ready for approval.` : ""}` };
}

/** Reject a new shop: deactivate it and cancel orders still waiting. */
export async function rejectShop(f: FormData) {
  const user = await requireRole("admin");
  const id = str(f, "id");
  await db.update(retailers).set({ status: "inactive", updatedBy: user.id, updatedAt: new Date() }).where(eq(retailers.id, id));
  const waiting = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.retailerId, id), eq(orders.status, "booked")));
  for (const o of waiting) await cancelOrder({ orderId: o.id, reason: "Shop rejected by office", userId: user.id });
  refresh();
}

// ======================================================= Office orders
/** Admin books an order (e.g. retailer phoned in). Uses current server prices. */
export async function createOfficeOrder(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await requireRole("admin");
  const retailerId = str(f, "retailerId");
  const bookedBy = str(f, "bookedBy") || user.id;
  let lines: { productId: string; qty: number }[];
  try {
    lines = JSON.parse(str(f, "lines") || "[]");
  } catch {
    return { error: "Could not read the items." };
  }
  lines = lines.filter((l) => l.productId && l.qty > 0);
  if (!retailerId) return { error: "Choose the shop." };
  if (!lines.length) return { error: "Add at least one product with quantity." };
  const [booker] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, bookedBy));
  if (!booker || (booker.role !== "admin" && booker.role !== "salesman")) return { error: "Choose who the order is booked for." };

  const id = crypto.randomUUID();
  try {
    await createOrder({
      id,
      retailerId,
      bookedBy,
      notes: optStr(f, "notes"),
      lines: lines.map((l) => ({ productId: l.productId, qty: Math.floor(l.qty), price: 0 })),
      clientPrices: false,
    });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    throw e;
  }
  redirect(`/admin/orders/${id}`);
}
