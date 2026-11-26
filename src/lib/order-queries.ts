import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import {
  allocations,
  batches,
  orderLines,
  orders,
  payments,
  products,
  retailers,
  users,
  warehouses,
  type OrderStatus,
} from "@/lib/db/schema";
import { stockLevels } from "@/lib/stock";
import { getBalance } from "@/lib/ledger";

const salesman = alias(users, "salesman");
const deliveryPerson = alias(users, "delivery_person");

export async function listOrders(opts: {
  status?: OrderStatus[];
  q?: string;
  salesmanId?: string;
  deliveryPersonId?: string;
  limit?: number;
}) {
  const where: SQL[] = [];
  if (opts.status?.length) where.push(inArray(orders.status, opts.status));
  if (opts.salesmanId) where.push(eq(orders.salesmanId, opts.salesmanId));
  if (opts.deliveryPersonId) where.push(eq(orders.deliveryPersonId, opts.deliveryPersonId));
  const q = opts.q?.trim();
  if (q) {
    const n = Number(q.replace(/^#/, ""));
    where.push(
      or(
        ilike(retailers.name, `%${q}%`),
        ilike(retailers.area, `%${q}%`),
        Number.isInteger(n) && n > 0 ? eq(orders.orderNo, n) : sql`false`,
      )!,
    );
  }
  return db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      status: orders.status,
      total: orders.total,
      deliveredTotal: orders.deliveredTotal,
      bookedAt: orders.bookedAt,
      creditFlag: orders.creditFlag,
      priceFlag: orders.priceFlag,
      retailerId: retailers.id,
      retailer: retailers.name,
      retailerStatus: retailers.status,
      area: retailers.area,
      address: retailers.address,
      phone: retailers.phone,
      salesman: salesman.name,
      deliveryPerson: deliveryPerson.name,
      warehouse: warehouses.name,
      items: sql<number>`(select count(*)::int from order_lines l where l.order_id = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(retailers, eq(retailers.id, orders.retailerId))
    .innerJoin(salesman, eq(salesman.id, orders.salesmanId))
    .leftJoin(deliveryPerson, eq(deliveryPerson.id, orders.deliveryPersonId))
    .leftJoin(warehouses, eq(warehouses.id, orders.warehouseId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(orders.orderNo))
    .limit(opts.limit ?? 200);
}

export async function getOrderDetail(id: string) {
  const [row] = await db
    .select({
      order: orders,
      retailer: retailers,
      salesman: salesman.name,
      deliveryPerson: deliveryPerson.name,
      warehouse: warehouses.name,
    })
    .from(orders)
    .innerJoin(retailers, eq(retailers.id, orders.retailerId))
    .innerJoin(salesman, eq(salesman.id, orders.salesmanId))
    .leftJoin(deliveryPerson, eq(deliveryPerson.id, orders.deliveryPersonId))
    .leftJoin(warehouses, eq(warehouses.id, orders.warehouseId))
    .where(eq(orders.id, id));
  if (!row) return null;

  const lines = await db
    .select({
      id: orderLines.id,
      productId: orderLines.productId,
      qty: orderLines.qty,
      approvedQty: orderLines.approvedQty,
      deliveredQty: orderLines.deliveredQty,
      price: orderLines.price,
      priceSource: orderLines.priceSource,
      name: products.name,
      sku: products.sku,
      unit: products.unit,
      caseSize: products.caseSize,
      currentBase: products.basePrice,
    })
    .from(orderLines)
    .innerJoin(products, eq(products.id, orderLines.productId))
    .where(eq(orderLines.orderId, id))
    .orderBy(asc(products.name));

  const picks = await db
    .select({
      lineId: allocations.orderLineId,
      qty: allocations.qty,
      batchNo: batches.batchNo,
      expiry: batches.expiry,
    })
    .from(allocations)
    .innerJoin(batches, eq(batches.id, allocations.batchId))
    .where(
      inArray(
        allocations.orderLineId,
        lines.map((l) => l.id).concat("__none__"),
      ),
    )
    .orderBy(asc(batches.expiry));

  const orderPayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      mode: payments.mode,
      status: payments.status,
      reference: payments.reference,
      collectedAt: payments.collectedAt,
      collectedBy: users.name,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.collectedBy))
    .where(eq(payments.orderId, id));

  const whs = await db
    .select({ id: warehouses.id, name: warehouses.name })
    .from(warehouses)
    .where(eq(warehouses.active, true))
    .orderBy(asc(warehouses.name));

  // Availability per warehouse (only needed while waiting for approval)
  const availability: Record<string, Record<string, number>> = {};
  if (row.order.status === "booked") {
    const pids = [...new Set(lines.map((l) => l.productId))];
    for (const w of whs) {
      const lv = await stockLevels(w.id, pids);
      availability[w.id] = Object.fromEntries(pids.map((p) => [p, lv.get(p)?.available ?? 0]));
    }
  }

  const deliveryPeople = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), inArray(users.role, ["delivery"])))
    .orderBy(asc(users.name));

  const balance = await getBalance(row.retailer.id);

  return { ...row, lines, picks, payments: orderPayments, warehouses: whs, availability, deliveryPeople, balance };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
