import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import type { DB, Tx } from "@/lib/db/client";

export type Balance = {
  retailerId: string;
  /** What the retailer owes now: opening + delivered − paid (paise) */
  outstanding: number;
  /** Part of outstanding older than the retailer's credit days (payments settle oldest bills first) */
  overdue: number;
  /** Value of orders booked but not yet delivered */
  openOrders: number;
  creditLimit: number | null;
};

const DELIVERED = sql`('delivered','partially_delivered')`;
const OPEN = sql`('booked','approved','packed','dispatched')`;

/**
 * Balances for all retailers (or one).
 * Overdue uses FIFO: since payments clear the oldest bills first, whatever is unpaid
 * beyond the bills still inside the credit period is overdue.
 */
export async function getBalances(retailerId?: string, conn: DB | Tx = db): Promise<Map<string, Balance>> {
  const where = retailerId ? sql`where r.id = ${retailerId}` : sql``;
  const res = await conn.execute<{
    id: string;
    credit_limit: number | null;
    outstanding: string | number;
    recent: string | number;
    open_orders: string | number;
  }>(sql`
    select r.id, r.credit_limit,
      r.opening_balance + coalesce(inv.total, 0) - coalesce(pay.total, 0) as outstanding,
      coalesce(recent.total, 0) as recent,
      coalesce(op.total, 0) as open_orders
    from retailers r
    left join (
      select retailer_id, sum(delivered_total) as total from orders
      where status in ${DELIVERED} group by retailer_id
    ) inv on inv.retailer_id = r.id
    left join (
      select retailer_id, sum(amount) as total from payments group by retailer_id
    ) pay on pay.retailer_id = r.id
    left join (
      select o.retailer_id, sum(o.delivered_total) as total
      from orders o join retailers r2 on r2.id = o.retailer_id
      where o.status in ${DELIVERED}
        and o.delivered_at > now() - make_interval(days => r2.credit_days)
      group by o.retailer_id
    ) recent on recent.retailer_id = r.id
    left join (
      select retailer_id, sum(total) as total from orders
      where status in ${OPEN} group by retailer_id
    ) op on op.retailer_id = r.id
    ${where}
  `);
  const map = new Map<string, Balance>();
  for (const row of res.rows) {
    const outstanding = Number(row.outstanding);
    const recent = Number(row.recent);
    map.set(row.id, {
      retailerId: row.id,
      outstanding,
      overdue: Math.max(0, outstanding - recent),
      openOrders: Number(row.open_orders),
      creditLimit: row.credit_limit,
    });
  }
  return map;
}

export async function getBalance(retailerId: string, conn: DB | Tx = db): Promise<Balance> {
  return (
    (await getBalances(retailerId, conn)).get(retailerId) ?? {
      retailerId,
      outstanding: 0,
      overdue: 0,
      openOrders: 0,
      creditLimit: null,
    }
  );
}
