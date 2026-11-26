import Link from "next/link";
import { and, asc, desc, eq, gt, isNotNull, lte, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { batches, products, stockMovements, users, warehouses } from "@/lib/db/schema";
import { stockSummary } from "@/lib/stock";
import { dateOnly, dateTime, daysUntil, qtyLabel } from "@/lib/format";
import { Badge, Card, Empty, LinkButton, PageHeader, Table, Tabs, cn } from "@/components/ui";

const KIND: Record<string, { label: string; tone: "green" | "red" | "amber" | "blue" }> = {
  purchase: { label: "Purchase", tone: "green" },
  dispatch: { label: "Dispatch", tone: "blue" },
  undelivered: { label: "Returned", tone: "amber" },
  adjustment: { label: "Adjustment", tone: "red" },
};

export default async function StockPage({ searchParams }: PageProps<"/admin/stock">) {
  await requireRole("admin");
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : "summary";
  const wh = typeof sp.wh === "string" ? sp.wh : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const whs = await db.select().from(warehouses).where(eq(warehouses.active, true)).orderBy(asc(warehouses.name));
  const qs = (v: string) => `/admin/stock?view=${v}${wh ? `&wh=${wh}` : ""}`;

  return (
    <>
      <PageHeader
        title="Stock"
        sub="Reserved = approved orders not yet dispatched. Available = on hand − reserved."
        actions={<LinkButton href="/admin/purchases/new">Receive stock</LinkButton>}
      />
      <Tabs
        active={view}
        items={[
          { key: "summary", label: "Stock levels", href: qs("summary") },
          { key: "expiry", label: "Expiring soon", href: qs("expiry") },
          { key: "movements", label: "Movements", href: qs("movements") },
        ]}
      />
      <form className="mb-3 flex flex-wrap gap-2">
        <input type="hidden" name="view" value={view} />
        {view === "summary" && <input name="q" defaultValue={q} placeholder="Search product" className="input h-10 max-w-xs" />}
        <select name="wh" defaultValue={wh} className="input h-10 w-48">
          <option value="">All warehouses</option>
          {whs.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <button className="input h-10 w-auto bg-gray-50 px-4 font-medium">Apply</button>
      </form>
      {view === "expiry" ? <ExpiryView wh={wh} /> : view === "movements" ? <MovementsView wh={wh} /> : <SummaryView wh={wh} q={q} />}
    </>
  );
}

async function SummaryView({ wh, q }: { wh: string; q: string }) {
  const rows = await stockSummary({ warehouseId: wh || undefined, q });
  if (!rows.length)
    return (
      <Card>
        <Empty>No products.</Empty>
      </Card>
    );
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <th>Product</th>
            <th className="hidden md:table-cell">Warehouse</th>
            <th className="text-right">On hand</th>
            <th className="text-right hidden sm:table-cell">Reserved</th>
            <th className="text-right">Available</th>
            <th className="hidden lg:table-cell">Nearest expiry</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const days = daysUntil(r.nearestExpiry);
            return (
              <tr key={r.productId + r.warehouseId} className="hover:bg-gray-50">
                <td>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-gray-500">
                    {r.sku}
                    <span className="md:hidden"> · {r.warehouseName}</span>
                  </div>
                </td>
                <td className="hidden md:table-cell text-gray-600">{r.warehouseName}</td>
                <td className="text-right whitespace-nowrap">{qtyLabel(r.onHand, r.caseSize, r.unit)}</td>
                <td className="text-right whitespace-nowrap hidden sm:table-cell text-gray-500">
                  {r.reserved ? qtyLabel(r.reserved, r.caseSize, r.unit) : "—"}
                </td>
                <td
                  className={cn(
                    "text-right whitespace-nowrap font-medium",
                    r.available <= 0 ? "text-red-700" : r.available < r.caseSize * 2 ? "text-amber-700" : "",
                  )}
                >
                  {r.available <= 0 ? "Out of stock" : qtyLabel(r.available, r.caseSize, r.unit)}
                </td>
                <td className={cn("hidden lg:table-cell whitespace-nowrap", days != null && days <= 30 ? "text-amber-700" : "text-gray-500")}>
                  {r.nearestExpiry ? dateOnly(r.nearestExpiry) : "—"}
                </td>
                <td className="text-right">
                  <Link href={`/admin/stock/adjust?productId=${r.productId}&wh=${r.warehouseId}`} className="text-sm text-brand-700">
                    Batches
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

async function ExpiryView({ wh }: { wh: string }) {
  const rows = await db
    .select({ b: batches, name: products.name, unit: products.unit, caseSize: products.caseSize, warehouse: warehouses.name })
    .from(batches)
    .innerJoin(products, eq(products.id, batches.productId))
    .innerJoin(warehouses, eq(warehouses.id, batches.warehouseId))
    .where(
      and(
        gt(batches.qty, 0),
        isNotNull(batches.expiry),
        lte(batches.expiry, sql`current_date + 60`),
        wh ? eq(batches.warehouseId, wh) : undefined,
      ),
    )
    .orderBy(asc(batches.expiry));
  if (!rows.length)
    return (
      <Card>
        <Empty>Nothing expires in the next 60 days.</Empty>
      </Card>
    );
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Batch</th>
            <th>Qty</th>
            <th>Expiry</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ b, name, unit, caseSize, warehouse }) => {
            const days = daysUntil(b.expiry)!;
            return (
              <tr key={b.id}>
                <td>
                  <Link href={`/admin/stock/adjust?productId=${b.productId}&wh=${b.warehouseId}`} className="font-medium hover:text-brand-700">
                    {name}
                  </Link>
                  <div className="text-xs text-gray-500">{warehouse}</div>
                </td>
                <td>{b.batchNo}</td>
                <td className="whitespace-nowrap">{qtyLabel(b.qty, caseSize, unit)}</td>
                <td>
                  <Badge tone={days < 0 ? "red" : days <= 30 ? "amber" : "gray"}>
                    {days < 0 ? `Expired ${-days}d ago` : `${days} days`} · {dateOnly(b.expiry)}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

async function MovementsView({ wh }: { wh: string }) {
  const rows = await db
    .select({
      m: stockMovements,
      name: products.name,
      unit: products.unit,
      caseSize: products.caseSize,
      batchNo: batches.batchNo,
      warehouse: warehouses.name,
      by: users.name,
    })
    .from(stockMovements)
    .innerJoin(products, eq(products.id, stockMovements.productId))
    .innerJoin(batches, eq(batches.id, stockMovements.batchId))
    .innerJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
    .leftJoin(users, eq(users.id, stockMovements.createdBy))
    .where(wh ? eq(stockMovements.warehouseId, wh) : undefined)
    .orderBy(desc(stockMovements.createdAt))
    .limit(300);
  return (
    <Card>
      <Table>
        <thead>
          <tr>
            <th>When</th>
            <th>Product</th>
            <th>Type</th>
            <th className="text-right">Qty</th>
            <th className="hidden md:table-cell">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, name, unit, caseSize, batchNo, warehouse, by }) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap text-gray-600">{dateTime(m.createdAt)}</td>
              <td>
                <div className="font-medium">{name}</div>
                <div className="text-xs text-gray-500">
                  {warehouse} · batch {batchNo}
                </div>
              </td>
              <td>
                <Badge tone={KIND[m.kind].tone}>{KIND[m.kind].label}</Badge>
              </td>
              <td className={cn("text-right whitespace-nowrap tabular-nums", m.qty < 0 ? "text-red-700" : "text-emerald-700")}>
                {m.qty > 0 ? "+" : "−"}
                {qtyLabel(Math.abs(m.qty), caseSize, unit)}
              </td>
              <td className="hidden md:table-cell text-gray-600">
                {m.note}
                {by && <span className="text-gray-400"> · {by}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
