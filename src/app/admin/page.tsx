import Link from "next/link";
import { GettingStarted } from "./getting-started";
import { desc, eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orders, retailers, users } from "@/lib/db/schema";
import { getBalances } from "@/lib/ledger";
import { dateTime, money } from "@/lib/format";
import { Card, CardHeader, Empty, PageHeader, Stat, StatusBadge, Table, Badge } from "@/components/ui";

export default async function AdminDashboard() {
  await requireRole("admin");

  const [statusCounts, todayRows, cashRows, expiryRows, recent, balances, newShops] = await Promise.all([
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db
      .select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${orders.total}),0)::bigint` })
      .from(orders)
      .where(sql`${orders.bookedAt} >= date_trunc('day', now()) and ${orders.status} <> 'cancelled'`),
    db.execute<{ total: string | number }>(
      sql`select coalesce(sum(amount),0) as total from payments where status = 'with_staff'`,
    ),
    db.execute<{ n: number }>(
      sql`select count(*)::int as n from batches where qty > 0 and expiry is not null and expiry <= current_date + 30`,
    ),
    db
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        status: orders.status,
        total: orders.total,
        bookedAt: orders.bookedAt,
        creditFlag: orders.creditFlag,
        retailer: retailers.name,
        salesman: users.name,
      })
      .from(orders)
      .innerJoin(retailers, eq(retailers.id, orders.retailerId))
      .innerJoin(users, eq(users.id, orders.salesmanId))
      .orderBy(desc(orders.orderNo))
      .limit(8),
    getBalances(),
    db.execute<{ n: number }>(sql`select count(*)::int as n from retailers where status = 'pending'`),
  ]);

  const count = (s: string) => statusCounts.find((r) => r.status === s)?.n ?? 0;
  let outstanding = 0;
  let overdue = 0;
  let overdueShops = 0;
  for (const b of balances.values()) {
    outstanding += Math.max(0, b.outstanding);
    overdue += b.overdue;
    if (b.overdue > 0) overdueShops++;
  }

  return (
    <>
      <PageHeader title="Dashboard" sub="What needs attention today" />
      <GettingStarted />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="To approve" value={count("booked")} href="/admin/orders?status=booked" tone={count("booked") ? "warn" : "default"} />
        <Stat label="To pack" value={count("approved")} href="/admin/orders?status=approved" />
        <Stat label="To dispatch" value={count("packed")} href="/admin/orders?status=packed" />
        <Stat label="Out for delivery" value={count("dispatched")} href="/admin/orders?status=dispatched" />
        <Stat
          label="Booked today"
          value={money(Number(todayRows[0]?.total ?? 0))}
          sub={`${todayRows[0]?.n ?? 0} orders`}
        />
        <Stat label="Market outstanding" value={money(outstanding)} href="/admin/retailers?sort=outstanding" />
        <Stat
          label="Overdue"
          value={money(overdue)}
          sub={`${overdueShops} retailers`}
          tone={overdue > 0 ? "bad" : "default"}
          href="/admin/retailers?sort=overdue"
        />
        <Stat
          label="Cash with staff"
          value={money(Number(cashRows.rows[0]?.total ?? 0))}
          href="/admin/payments?status=with_staff"
          tone={Number(cashRows.rows[0]?.total ?? 0) > 0 ? "warn" : "default"}
        />
      </div>

      {Number(newShops.rows[0]?.n ?? 0) > 0 && (
        <Link
          href="/admin/retailers?status=pending"
          className="mt-3 block rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 hover:bg-brand-100"
        >
          🏪 {newShops.rows[0].n} new shop(s) added by salesmen are waiting for your approval →
        </Link>
      )}
      {Number(expiryRows.rows[0]?.n ?? 0) > 0 && (
        <Link
          href="/admin/stock?view=expiry"
          className="mt-3 block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          ⚠ {expiryRows.rows[0].n} batches expire within 30 days. View them →
        </Link>
      )}

      <Card className="mt-5">
        <CardHeader title="Latest orders" action={<Link href="/admin/orders" className="text-sm text-brand-700">All orders →</Link>} />
        {recent.length === 0 ? (
          <Empty>No orders yet. Salesmen book orders from the Sales app.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>Retailer</th>
                <th className="hidden sm:table-cell">Salesman</th>
                <th className="hidden md:table-cell">Booked</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-brand-700">
                      {o.orderNo}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/admin/orders/${o.id}`}>{o.retailer}</Link>
                    {o.creditFlag && o.status === "booked" && (
                      <Badge tone="red" className="ml-2">
                        Credit
                      </Badge>
                    )}
                  </td>
                  <td className="hidden sm:table-cell text-gray-600">{o.salesman}</td>
                  <td className="hidden md:table-cell text-gray-600">{dateTime(o.bookedAt)}</td>
                  <td className="text-right tabular-nums">{money(o.total)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
