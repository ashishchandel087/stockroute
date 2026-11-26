import Link from "next/link";
import type { listOrders } from "@/lib/order-queries";
import { dateTime, money } from "@/lib/format";
import { Badge, Card, Empty, StatusBadge } from "./ui";

type Row = Awaited<ReturnType<typeof listOrders>>[number];

/** Order list: a table on large screens, cards on phones. */
export function OrderList({ rows, hrefBase, empty }: { rows: Row[]; hrefBase: string; empty: string }) {
  if (!rows.length)
    return (
      <Card>
        <Empty>{empty}</Empty>
      </Card>
    );
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-gray-100">
        {rows.map((o) => (
          <li key={o.id}>
            <Link href={`${hrefBase}/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <div className="w-12 shrink-0 text-sm font-semibold text-brand-700">#{o.orderNo}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-medium text-gray-900">{o.retailer}</span>
                  {o.retailerStatus === "pending" && o.status === "booked" && <Badge tone="amber">New shop</Badge>}
                  {o.creditFlag && o.status === "booked" && o.retailerStatus !== "pending" && <Badge tone="red">Credit</Badge>}
                  {o.priceFlag && o.status === "booked" && <Badge tone="amber">Price</Badge>}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {o.area ?? "—"} · {o.items} items · {o.salesman} · {dateTime(o.bookedAt)}
                  {o.deliveryPerson && ` · 🚚 ${o.deliveryPerson}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">{money(o.deliveredTotal ?? o.total)}</div>
                <StatusBadge status={o.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
