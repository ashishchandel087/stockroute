import "server-only";
/**
 * Order lifecycle. Every step runs in one transaction and locks what it touches.
 *
 *  booked ──approve──▶ approved ──pack──▶ packed ──dispatch──▶ dispatched ──deliver──▶ delivered / partially_delivered
 *     └──────────────── cancel (any time before dispatch) ─────────────────▶ cancelled
 *
 * Stock effects
 *  approve : reserves stock (approved qty counts as "reserved", checked against available)
 *  pack    : picks batches, earliest expiry first (allocations)
 *  dispatch: deducts batch qty (stock leaves the warehouse)
 *  deliver : undelivered qty goes back into the batches it came from
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db/client";
import { allocations, batches, orderLines, orders, payments, products, retailers, stockMovements, users } from "@/lib/db/schema";
import type { OrderStatus, PaymentMode } from "@/lib/db/schema";
import { lockBatches, stockLevels } from "@/lib/stock";
import { qtyLabel } from "@/lib/format";

export class DomainError extends Error {}

async function lockOrder(tx: Tx, orderId: string, expected: OrderStatus[]) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o) throw new DomainError("Order not found.");
  if (!expected.includes(o.status)) {
    throw new DomainError(`This order is already "${o.status.replace("_", " ")}". Refresh the page.`);
  }
  return o;
}

async function linesWithProducts(tx: Tx, orderId: string) {
  return tx
    .select({
      line: orderLines,
      product: { id: products.id, name: products.name, caseSize: products.caseSize, unit: products.unit },
    })
    .from(orderLines)
    .innerJoin(products, eq(products.id, orderLines.productId))
    .where(eq(orderLines.orderId, orderId))
    .orderBy(asc(products.name));
}

// ---------------------------------------------------------------- approve
export async function approveOrder(input: {
  orderId: string;
  warehouseId: string;
  lines: { lineId: string; approvedQty: number }[];
  userId: string;
}) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId, ["booked"]);
    const [shop] = await tx.select({ status: retailers.status }).from(retailers).where(eq(retailers.id, order.retailerId));
    if (shop?.status === "pending") throw new DomainError("This is a new shop. Approve the shop first (Retailers → shop).");
    if (shop?.status === "inactive") throw new DomainError("This shop is inactive. Cancel the order or reactivate the shop.");
    const lines = await linesWithProducts(tx, order.id);
    const productIds = [...new Set(lines.map((l) => l.line.productId))];
    await lockBatches(tx, input.warehouseId, productIds);
    const levels = await stockLevels(input.warehouseId, productIds, tx, order.id);

    const wanted = new Map(input.lines.map((l) => [l.lineId, l.approvedQty]));
    const usedPerProduct = new Map<string, number>();
    let approvedTotal = 0;
    let approvedValue = 0;

    for (const { line, product } of lines) {
      const qty = Math.floor(wanted.get(line.id) ?? line.qty);
      if (!Number.isFinite(qty) || qty < 0) throw new DomainError(`Invalid quantity for ${product.name}.`);
      if (qty > line.qty) throw new DomainError(`${product.name}: can't approve more than ordered.`);
      const used = usedPerProduct.get(product.id) ?? 0;
      const available = (levels.get(product.id)?.available ?? 0) - used;
      if (qty > available) {
        throw new DomainError(
          `${product.name}: only ${qtyLabel(Math.max(0, available), product.caseSize, product.unit)} available in this warehouse.`,
        );
      }
      usedPerProduct.set(product.id, used + qty);
      approvedTotal += qty;
      approvedValue += qty * line.price;
      await tx.update(orderLines).set({ approvedQty: qty }).where(eq(orderLines.id, line.id));
    }
    if (approvedTotal === 0) throw new DomainError("Nothing approved. Cancel the order instead.");

    await tx
      .update(orders)
      // Order value now reflects what was approved (used for credit exposure and lists)
      .set({
        status: "approved",
        total: approvedValue,
        warehouseId: input.warehouseId,
        approvedBy: input.userId,
        approvedAt: new Date(),
      })
      .where(eq(orders.id, order.id));
  });
}

// ---------------------------------------------------------------- pack
export async function packOrder(input: { orderId: string; userId: string }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId, ["approved"]);
    if (!order.warehouseId) throw new DomainError("Order has no warehouse.");
    const lines = await linesWithProducts(tx, order.id);
    const productIds = [...new Set(lines.map((l) => l.line.productId))];
    await lockBatches(tx, order.warehouseId, productIds);

    for (const { line, product } of lines) {
      let remaining = line.approvedQty ?? 0;
      if (remaining <= 0) continue;
      // Free qty per batch = on hand − already picked for other packed (not yet dispatched) orders
      const res = await tx.execute<{ id: string; free: string | number }>(sql`
        select b.id, b.qty - coalesce((
          select sum(a.qty) from allocations a
          join order_lines l on l.id = a.order_line_id join orders o on o.id = l.order_id
          where a.batch_id = b.id and o.status = 'packed'
        ), 0) as free
        from batches b
        where b.product_id = ${product.id} and b.warehouse_id = ${order.warehouseId} and b.qty > 0
        order by b.expiry asc nulls last, b.created_at asc
      `);
      for (const b of res.rows) {
        const free = Number(b.free);
        if (free <= 0) continue;
        const take = Math.min(free, remaining);
        await tx.insert(allocations).values({ orderLineId: line.id, batchId: b.id, qty: take });
        remaining -= take;
        if (remaining === 0) break;
      }
      if (remaining > 0) {
        throw new DomainError(
          `${product.name}: ${qtyLabel(remaining, product.caseSize, product.unit)} short in the warehouse. Check stock or adjust.`,
        );
      }
    }
    await tx
      .update(orders)
      .set({ status: "packed", packedBy: input.userId, packedAt: new Date() })
      .where(eq(orders.id, order.id));
  });
}

// ---------------------------------------------------------------- dispatch
export async function dispatchOrder(input: { orderId: string; deliveryPersonId: string; userId: string }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId, ["packed"]);
    const [dp] = await tx.select().from(users).where(eq(users.id, input.deliveryPersonId));
    if (!dp || !dp.active || (dp.role !== "delivery" && dp.role !== "admin")) {
      throw new DomainError("Choose a delivery person.");
    }
    const allocs = await tx
      .select({ a: allocations, productId: orderLines.productId })
      .from(allocations)
      .innerJoin(orderLines, eq(orderLines.id, allocations.orderLineId))
      .where(eq(orderLines.orderId, order.id));

    for (const { a, productId } of allocs) {
      const [b] = await tx
        .update(batches)
        .set({ qty: sql`${batches.qty} - ${a.qty}` })
        .where(eq(batches.id, a.batchId))
        .returning();
      if (b.qty < 0) throw new DomainError("Stock went negative while dispatching. Recheck stock.");
      await tx.insert(stockMovements).values({
        productId,
        warehouseId: b.warehouseId,
        batchId: b.id,
        qty: -a.qty,
        kind: "dispatch",
        refId: order.id,
        note: `Order #${order.orderNo}`,
        createdBy: input.userId,
      });
    }
    await tx
      .update(orders)
      .set({
        status: "dispatched",
        dispatchedBy: input.userId,
        dispatchedAt: new Date(),
        deliveryPersonId: input.deliveryPersonId,
      })
      .where(eq(orders.id, order.id));
  });
}

// ---------------------------------------------------------------- deliver
export async function deliverOrder(input: {
  orderId: string;
  lines: { lineId: string; deliveredQty: number }[];
  payment?: { amount: number; mode: PaymentMode; reference?: string | null };
  userId: string;
  isAdmin: boolean;
}) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId, ["dispatched"]);
    if (!input.isAdmin && order.deliveryPersonId !== input.userId) {
      throw new DomainError("This order is assigned to someone else.");
    }
    const lines = await linesWithProducts(tx, order.id);
    const given = new Map(input.lines.map((l) => [l.lineId, l.deliveredQty]));
    let deliveredTotal = 0;
    let allFull = true;

    for (const { line, product } of lines) {
      const approved = line.approvedQty ?? 0;
      const delivered = Math.floor(given.get(line.id) ?? approved);
      if (!Number.isFinite(delivered) || delivered < 0 || delivered > approved) {
        throw new DomainError(`${product.name}: delivered qty must be between 0 and ${approved}.`);
      }
      if (delivered < approved) allFull = false;
      deliveredTotal += delivered * line.price;
      await tx.update(orderLines).set({ deliveredQty: delivered }).where(eq(orderLines.id, line.id));

      // Put undelivered goods back into stock (latest-expiry batch first)
      let back = approved - delivered;
      if (back > 0) {
        const allocs = await tx
          .select({ a: allocations, expiry: batches.expiry, warehouseId: batches.warehouseId })
          .from(allocations)
          .innerJoin(batches, eq(batches.id, allocations.batchId))
          .where(eq(allocations.orderLineId, line.id))
          .orderBy(desc(batches.expiry));
        for (const { a, warehouseId } of allocs) {
          if (back <= 0) break;
          const qty = Math.min(a.qty, back);
          await tx.update(batches).set({ qty: sql`${batches.qty} + ${qty}` }).where(eq(batches.id, a.batchId));
          await tx.insert(stockMovements).values({
            productId: line.productId,
            warehouseId,
            batchId: a.batchId,
            qty,
            kind: "undelivered",
            refId: order.id,
            note: `Returned from order #${order.orderNo}`,
            createdBy: input.userId,
          });
          back -= qty;
        }
      }
    }

    await tx
      .update(orders)
      .set({
        status: allFull ? "delivered" : "partially_delivered",
        deliveredTotal,
        deliveredAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    if (input.payment && input.payment.amount > 0) {
      await tx.insert(payments).values({
        id: crypto.randomUUID(),
        retailerId: order.retailerId,
        amount: input.payment.amount,
        mode: input.payment.mode,
        reference: input.payment.reference || null,
        orderId: order.id,
        collectedBy: input.userId,
        collectedAt: new Date(),
        status: paymentStatusFor(input.payment.mode, input.isAdmin),
        ...(input.isAdmin ? { receivedBy: input.userId, receivedAt: new Date() } : {}),
      });
    }
  });
}

/** Cash & cheques collected in the field stay "with staff" until handed over to the admin. */
export function paymentStatusFor(mode: PaymentMode, collectedByAdmin: boolean): "with_staff" | "received" {
  if (collectedByAdmin) return "received";
  return mode === "cash" || mode === "cheque" ? "with_staff" : "received";
}

// ---------------------------------------------------------------- cancel
export async function cancelOrder(input: { orderId: string; reason: string; userId: string }) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, input.orderId, ["booked", "approved", "packed"]);
    const lineIds = (await tx.select({ id: orderLines.id }).from(orderLines).where(eq(orderLines.orderId, order.id))).map(
      (l) => l.id,
    );
    if (lineIds.length) await tx.delete(allocations).where(inArray(allocations.orderLineId, lineIds));
    await tx
      .update(orders)
      .set({
        status: "cancelled",
        cancelledBy: input.userId,
        cancelledAt: new Date(),
        cancelReason: input.reason || null,
      })
      .where(and(eq(orders.id, order.id)));
  });
}
