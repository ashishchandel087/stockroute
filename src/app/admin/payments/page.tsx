import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orders, payments, retailers, users } from "@/lib/db/schema";
import { dateTime, MODE_LABEL, money } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Combobox } from "@/components/combobox";
import { Badge, Card, CardHeader, Empty, PageHeader, Tabs } from "@/components/ui";
import { markReceived, recordPayment } from "../actions";

const collector = alias(users, "collector");

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireRole("admin");
  const sp = await searchParams;
  const view = sp.status === "with_staff" ? "with_staff" : "all";

  const rows = await db
    .select({
      p: payments,
      retailer: retailers.name,
      retailerId: retailers.id,
      by: collector.name,
      byId: collector.id,
      orderNo: orders.orderNo,
    })
    .from(payments)
    .innerJoin(retailers, eq(retailers.id, payments.retailerId))
    .innerJoin(collector, eq(collector.id, payments.collectedBy))
    .leftJoin(orders, eq(orders.id, payments.orderId))
    .where(view === "with_staff" ? eq(payments.status, "with_staff") : undefined)
    .orderBy(desc(payments.collectedAt))
    .limit(300);
  const shops = await db
    .select({ id: retailers.id, name: retailers.name, area: retailers.area })
    .from(retailers)
    .orderBy(asc(retailers.name));

  // Group "with staff" by person, so the admin can confirm each handover in one go
  const groups = new Map<string, { name: string; total: number; rows: typeof rows }>();
  if (view === "with_staff") {
    for (const r of rows) {
      const g = groups.get(r.byId) ?? { name: r.by, total: 0, rows: [] };
      g.total += r.p.amount;
      g.rows.push(r);
      groups.set(r.byId, g);
    }
  }

  return (
    <>
      <PageHeader title="Payments" sub="Collections from retailers" />
      <Tabs
        active={view}
        items={[
          { key: "with_staff", label: "Cash with staff", href: "/admin/payments?status=with_staff" },
          { key: "all", label: "All payments", href: "/admin/payments" },
        ]}
      />

      {view === "with_staff" ? (
        groups.size === 0 ? (
          <Card>
            <Empty>All collected cash and cheques have been handed over. 👍</Empty>
          </Card>
        ) : (
          <div className="space-y-4">
            {[...groups.entries()].map(([id, g]) => (
              <Card key={id}>
                <form action={markReceived}>
                  <CardHeader
                    title={g.name}
                    sub={`Holding ${money(g.total)}`}
                    action={<SubmitButton size="sm" variant="success" pendingText="Saving…">Mark selected received</SubmitButton>}
                  />
                  <ul className="divide-y divide-gray-100 text-sm">
                    {g.rows.map((r) => (
                      <li key={r.p.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-gray-50">
                          <input type="checkbox" name="paymentId" value={r.p.id} defaultChecked className="h-4 w-4" />
                          <span className="flex-1">
                            {r.retailer}
                            <span className="ml-2 text-gray-500">
                              {MODE_LABEL[r.p.mode]}
                              {r.p.reference && ` ${r.p.reference}`} · {dateTime(r.p.collectedAt)}
                            </span>
                          </span>
                          <span className="font-medium tabular-nums">{money(r.p.amount)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </form>
              </Card>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            {rows.length === 0 ? (
              <Empty>No payments yet.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {rows.map((r) => (
                  <li key={r.p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/retailers/${r.retailerId}`} className="font-medium hover:text-brand-700">
                        {r.retailer}
                      </Link>
                      <div className="text-xs text-gray-500">
                        {MODE_LABEL[r.p.mode]}
                        {r.p.reference && ` · ${r.p.reference}`} · {r.by} · {dateTime(r.p.collectedAt)}
                        {r.orderNo && ` · order #${r.orderNo}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium tabular-nums">{money(r.p.amount)}</div>
                      {r.p.status === "with_staff" && <Badge tone="amber">with staff</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="h-fit">
            <CardHeader title="Record a payment" />
            <ActionForm action={recordPayment} resetOnSuccess className="space-y-2 p-4">
              <Combobox
                name="retailerId"
                placeholder="Retailer…"
                options={shops.map((s) => ({ id: s.id, label: s.name, sub: s.area ?? undefined }))}
              />
              <input name="amount" inputMode="decimal" placeholder="Amount ₹" className="input" required />
              <select name="mode" className="input" defaultValue="upi">
                <option value="upi">UPI</option>
                <option value="bank">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
              <input name="reference" placeholder="Ref / UTR / cheque no." className="input" />
              <input name="date" type="date" className="input" />
              <SubmitButton variant="success">Save payment</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
