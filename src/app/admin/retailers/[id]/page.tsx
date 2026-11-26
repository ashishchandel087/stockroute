import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { X } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orders, payments, products, retailerPrices, retailers, users } from "@/lib/db/schema";
import { getBalance } from "@/lib/ledger";
import { dateOnly, dateTime, MODE_LABEL, money } from "@/lib/format";
import { Alert, Badge, Card, CardHeader, Empty, PageHeader, Stat, StatusBadge, cn } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Combobox } from "@/components/combobox";
import { RetailerForm } from "../retailer-form";
import { retailerFormOptions } from "../form-data";
import { ApproveShopCard, ShopPhotoCard } from "../shop-extras";
import { recordPayment, removeRetailerPrice, setRetailerPrice } from "../../actions";

export default async function RetailerPage({ params, searchParams }: PageProps<"/admin/retailers/[id]">) {
  await requireRole("admin");
  const { id } = await params;
  const sp = await searchParams;
  const [r] = await db.select().from(retailers).where(eq(retailers.id, id));
  if (!r) notFound();

  const [opts, balance, recentOrders, deliveredOrders, pays, specials, allProducts, creator] = await Promise.all([
    retailerFormOptions(),
    getBalance(id),
    db.select().from(orders).where(eq(orders.retailerId, id)).orderBy(desc(orders.orderNo)).limit(10),
    db
      .select({ id: orders.id, orderNo: orders.orderNo, at: orders.deliveredAt, amount: orders.deliveredTotal })
      .from(orders)
      .where(and(eq(orders.retailerId, id), inArray(orders.status, ["delivered", "partially_delivered"]))),
    db
      .select({ p: payments, by: users.name })
      .from(payments)
      .innerJoin(users, eq(users.id, payments.collectedBy))
      .where(eq(payments.retailerId, id)),
    db
      .select({ id: retailerPrices.id, price: retailerPrices.price, name: products.name, base: products.basePrice, unit: products.unit })
      .from(retailerPrices)
      .innerJoin(products, eq(products.id, retailerPrices.productId))
      .where(eq(retailerPrices.retailerId, id))
      .orderBy(asc(products.name)),
    db
      .select({ id: products.id, name: products.name, sku: products.sku, base: products.basePrice })
      .from(products)
      .where(eq(products.active, true))
      .orderBy(asc(products.name)),
    r.createdBy ? db.select({ name: users.name }).from(users).where(eq(users.id, r.createdBy)) : Promise.resolve([]),
  ]);

  // Ledger: opening balance, bills (delivered orders), payments — with running balance
  type Entry = { at: Date; label: React.ReactNode; debit: number; credit: number };
  const entries: Entry[] = [];
  if (r.openingBalance) entries.push({ at: r.createdAt, label: "Opening balance", debit: r.openingBalance, credit: 0 });
  for (const o of deliveredOrders)
    entries.push({
      at: o.at ?? new Date(0),
      label: (
        <Link href={`/admin/orders/${o.id}`} className="text-brand-700">
          Bill · Order #{o.orderNo}
        </Link>
      ),
      debit: o.amount ?? 0,
      credit: 0,
    });
  for (const { p, by } of pays)
    entries.push({
      at: p.collectedAt,
      label: (
        <>
          Payment · {MODE_LABEL[p.mode]}
          {p.reference && ` (${p.reference})`} · {by}
          {p.status === "with_staff" && (
            <Badge tone="amber" className="ml-1">
              with staff
            </Badge>
          )}
        </>
      ),
      debit: 0,
      credit: p.amount,
    });
  entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  let running = 0;
  const ledger = entries.map((e) => ({ ...e, balance: (running += e.debit - e.credit) })).reverse();

  return (
    <>
      <PageHeader
        title={r.name}
        sub={[r.ownerName, r.area, r.phone].filter(Boolean).join(" · ")}
      />
      {sp.saved && (
        <div className="mb-3">
          <Alert tone="green">Retailer added.</Alert>
        </div>
      )}
      {r.status === "pending" && (
        <ApproveShopCard
          shop={r}
          addedBy={creator[0]?.name ?? null}
          waitingOrders={recentOrders.filter((o) => o.status === "booked").length}
          types={opts.types}
          warehouses={opts.warehouses}
        />
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Outstanding" value={money(balance.outstanding)} tone={r.creditLimit != null && balance.outstanding > r.creditLimit ? "bad" : "default"} />
        <Stat label="Overdue" value={money(balance.overdue)} tone={balance.overdue > 0 ? "bad" : "default"} sub={`after ${r.creditDays} days`} />
        <Stat label="Credit limit" value={r.creditLimit == null ? "No limit" : money(r.creditLimit)} />
        <Stat label="Orders in progress" value={money(balance.openOrders)} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 space-y-4 lg:col-span-3">
          <Card>
            <CardHeader title="Ledger" sub="Bills are added when goods are delivered" />
            {ledger.length === 0 ? (
              <Empty>No transactions yet.</Empty>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Entry</th>
                      <th className="px-4 py-2 text-right">Bill</th>
                      <th className="px-4 py-2 text-right">Paid</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">{dateOnly(e.at)}</td>
                        <td className="px-4 py-2">{e.label}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{e.debit ? money(e.debit) : ""}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{e.credit ? money(e.credit) : ""}</td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums">{money(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Record a payment" sub="UPI, bank transfer or cash received at the office" />
            <ActionForm action={recordPayment} resetOnSuccess className="grid gap-2 p-4 sm:grid-cols-4">
              <input type="hidden" name="retailerId" value={r.id} />
              <input name="amount" required inputMode="decimal" placeholder="Amount ₹" className="input" />
              <select name="mode" className="input" defaultValue="upi">
                <option value="upi">UPI</option>
                <option value="bank">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
              <input name="reference" placeholder="Ref / UTR / cheque no." className="input" />
              <SubmitButton variant="success">Save payment</SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Recent orders" />
            {recentOrders.length === 0 ? (
              <Empty>No orders yet.</Empty>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between px-4 py-2 hover:bg-gray-50">
                      <span>
                        <span className="font-medium text-brand-700">#{o.orderNo}</span>
                        <span className="ml-2 text-gray-500">{dateTime(o.bookedAt)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="tabular-nums">{money(o.deliveredTotal ?? o.total)}</span>
                        <StatusBadge status={o.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          <ShopPhotoCard shop={r} />
          <Card>
            <CardHeader title="Special prices" sub="Negotiated rates for this shop only" />
            {specials.length > 0 && (
              <ul className="divide-y divide-gray-100 text-sm">
                {specials.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span className="min-w-0 truncate">{s.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 line-through">{money(s.base)}</span>
                      <span className="font-medium tabular-nums">{money(s.price)}</span>
                      <form action={removeRetailerPrice}>
                        <input type="hidden" name="id" value={s.id} />
                        <button title="Remove" className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={setRetailerPrice} className={cn("space-y-2 p-4", specials.length > 0 && "border-t border-gray-100")}>
              <input type="hidden" name="retailerId" value={r.id} />
              <Combobox
                name="productId"
                placeholder="Search product…"
                options={allProducts.map((p) => ({ id: p.id, label: p.name, sub: `${p.sku} · base ${money(p.base)}` }))}
              />
              <div className="flex gap-2">
                <input name="price" inputMode="decimal" placeholder="Special price ₹ per piece" className="input" />
                <SubmitButton>Set</SubmitButton>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Shop details" />
            <RetailerForm retailer={r} {...opts} />
          </Card>
        </div>
      </div>
    </>
  );
}
