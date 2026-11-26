import "server-only";
import { sql } from "drizzle-orm";
import { db, type DB, type Tx } from "@/lib/db/client";

export type StockLevel = { onHand: number; reserved: number; available: number };

/**
 * Stock for products in one warehouse.
 * reserved = approved qty of orders that are approved or packed (not yet dispatched).
 * Optionally ignores one order (used when re-checking that same order).
 */
export async function stockLevels(
  warehouseId: string,
  productIds: string[],
  conn: DB | Tx = db,
  excludeOrderId?: string,
): Promise<Map<string, StockLevel>> {
  const map = new Map<string, StockLevel>();
  if (!productIds.length) return map;
  const ids = sql.join(
    productIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const exclude = excludeOrderId ? sql`and o.id <> ${excludeOrderId}` : sql``;
  const res = await conn.execute<{ product_id: string; on_hand: string | number; reserved: string | number }>(sql`
    select p.id as product_id,
      coalesce((select sum(b.qty) from batches b where b.product_id = p.id and b.warehouse_id = ${warehouseId}), 0) as on_hand,
      coalesce((
        select sum(l.approved_qty) from order_lines l join orders o on o.id = l.order_id
        where l.product_id = p.id and o.warehouse_id = ${warehouseId}
          and o.status in ('approved','packed') ${exclude}
      ), 0) as reserved
    from products p where p.id in (${ids})
  `);
  for (const r of res.rows) {
    const onHand = Number(r.on_hand);
    const reserved = Number(r.reserved);
    map.set(r.product_id, { onHand, reserved, available: onHand - reserved });
  }
  return map;
}

/** Locks all batch rows for these products in a warehouse (call inside a transaction). */
export async function lockBatches(tx: Tx, warehouseId: string, productIds: string[]) {
  if (!productIds.length) return;
  const ids = sql.join(
    productIds.map((id) => sql`${id}`),
    sql`, `,
  );
  await tx.execute(
    sql`select id from batches where warehouse_id = ${warehouseId} and product_id in (${ids}) order by id for update`,
  );
}

export type StockRow = {
  productId: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  caseSize: number;
  warehouseId: string;
  warehouseName: string;
  onHand: number;
  reserved: number;
  available: number;
  nearestExpiry: string | null;
};

/** Stock summary for the stock screen. */
export async function stockSummary(opts: { warehouseId?: string; q?: string } = {}): Promise<StockRow[]> {
  const wh = opts.warehouseId ? sql`and w.id = ${opts.warehouseId}` : sql``;
  const q = opts.q?.trim() ? sql`and (p.name ilike ${"%" + opts.q.trim() + "%"} or p.sku ilike ${"%" + opts.q.trim() + "%"} or p.brand ilike ${"%" + opts.q.trim() + "%"})` : sql``;
  const res = await db.execute<{
    product_id: string;
    sku: string;
    name: string;
    brand: string | null;
    category: string | null;
    unit: string;
    case_size: number;
    warehouse_id: string;
    warehouse_name: string;
    on_hand: string | number;
    reserved: string | number;
    nearest_expiry: string | null;
  }>(sql`
    select p.id as product_id, p.sku, p.name, p.brand, p.category, p.unit, p.case_size,
      w.id as warehouse_id, w.name as warehouse_name,
      coalesce((select sum(b.qty) from batches b where b.product_id = p.id and b.warehouse_id = w.id), 0) as on_hand,
      coalesce((
        select sum(l.approved_qty) from order_lines l join orders o on o.id = l.order_id
        where l.product_id = p.id and o.warehouse_id = w.id and o.status in ('approved','packed')
      ), 0) as reserved,
      (select min(b.expiry)::text from batches b where b.product_id = p.id and b.warehouse_id = w.id and b.qty > 0) as nearest_expiry
    from products p cross join warehouses w
    where p.active and w.active ${wh} ${q}
    order by p.name, w.name
  `);
  return res.rows.map((r) => {
    const onHand = Number(r.on_hand);
    const reserved = Number(r.reserved);
    return {
      productId: r.product_id,
      sku: r.sku,
      name: r.name,
      brand: r.brand,
      category: r.category,
      unit: r.unit,
      caseSize: r.case_size,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      onHand,
      reserved,
      available: onHand - reserved,
      nearestExpiry: r.nearest_expiry,
    };
  });
}
