import { and, desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { payments, retailers } from "@/lib/db/schema";
import { dateTime, MODE_LABEL, money } from "@/lib/format";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";

export default async function MyCollections() {
  const user = await requireRole("admin", "delivery");
  const rows = await db
    .select({ p: payments, retailer: retailers.name })
    .from(payments)
    .innerJoin(retailers, eq(retailers.id, payments.retailerId))
    .where(and(eq(payments.collectedBy, user.id)))
    .orderBy(desc(payments.collectedAt))
    .limit(100);
  const holding = rows.filter((r) => r.p.status === "with_staff").reduce((s, r) => s + r.p.amount, 0);
  return (
    <>
      <PageHeader title="My collections" />
      <div className="mb-4 max-w-xs">
        <Stat label="Cash/cheques to hand over" value={money(holding)} tone={holding > 0 ? "warn" : "default"} />
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty>No collections yet.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {rows.map((r) => (
              <li key={r.p.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <div className="font-medium">{r.retailer}</div>
                  <div className="text-xs text-gray-500">
                    {MODE_LABEL[r.p.mode]} · {dateTime(r.p.collectedAt)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium tabular-nums">{money(r.p.amount)}</div>
                  <Badge tone={r.p.status === "with_staff" ? "amber" : "green"}>
                    {r.p.status === "with_staff" ? "with you" : "handed over"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
