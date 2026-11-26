import { sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orders, type OrderStatus } from "@/lib/db/schema";
import { listOrders } from "@/lib/order-queries";
import { OrderList } from "@/components/order-list";
import { Plus } from "lucide-react";
import { LinkButton, PageHeader, Tabs } from "@/components/ui";

const TABS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: "booked", label: "To approve", statuses: ["booked"] },
  { key: "approved", label: "To pack", statuses: ["approved"] },
  { key: "packed", label: "To dispatch", statuses: ["packed"] },
  { key: "dispatched", label: "Out for delivery", statuses: ["dispatched"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered", "partially_delivered"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
  { key: "all", label: "All" },
];

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireRole("admin");
  const sp = await searchParams;
  const active = typeof sp.status === "string" && TABS.some((t) => t.key === sp.status) ? sp.status : "booked";
  const q = typeof sp.q === "string" ? sp.q : "";
  const tab = TABS.find((t) => t.key === active)!;

  const [rows, counts] = await Promise.all([
    listOrders({ status: tab.statuses, q }),
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
  ]);
  const countFor = (t: (typeof TABS)[number]) =>
    t.statuses ? counts.filter((c) => t.statuses!.includes(c.status)).reduce((s, c) => s + c.n, 0) : null;

  return (
    <>
      <PageHeader
        title="Orders"
        sub="Approve, pack, dispatch and track every order"
        actions={
          <LinkButton href="/admin/orders/new">
            <Plus size={16} /> New order
          </LinkButton>
        }
      />
      <Tabs
        active={active}
        items={TABS.map((t) => {
          const n = countFor(t);
          return {
            key: t.key,
            href: `/admin/orders?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
            label: (
              <>
                {t.label}
                {n ? <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{n}</span> : null}
              </>
            ),
          };
        })}
      />
      <form className="mb-3 flex gap-2">
        <input type="hidden" name="status" value={active} />
        <input name="q" defaultValue={q} placeholder="Search retailer, area or order #" className="input h-10 max-w-sm" />
      </form>
      <OrderList rows={rows} hrefBase="/admin/orders" empty="No orders here." />
    </>
  );
}
