import Link from "next/link";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import type { OrderDetail } from "@/lib/order-queries";
import { dateTime, MODE_LABEL, money, qtyLabel, daysUntil } from "@/lib/format";
import { Alert, Badge, Card, CardHeader, StatusBadge, cn } from "./ui";
import { ApproveForm, CancelForm, DeliverForm, DispatchForm, PackForm } from "./order-forms";

type ViewerRole = "admin" | "warehouse" | "delivery";

export function OrderDetailView({
  d,
  role,
  userId,
  backHref,
}: {
  d: OrderDetail;
  role: ViewerRole;
  userId: string;
  backHref: string;
}) {
  const o = d.order;
  const r = d.retailer;
  const isAdmin = role === "admin";
  const canPack = (isAdmin || role === "warehouse") && o.status === "approved";
  const canDispatch = (isAdmin || role === "warehouse") && o.status === "packed";
  const canDeliver = o.status === "dispatched" && (isAdmin || (role === "delivery" && o.deliveryPersonId === userId));
  const canCancel = isAdmin && ["booked", "approved", "packed"].includes(o.status);
  const showPicks = ["packed", "dispatched", "delivered", "partially_delivered"].includes(o.status);
  const formLines = d.lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    name: l.name,
    unit: l.unit,
    caseSize: l.caseSize,
    qty: l.qty,
    approvedQty: l.approvedQty,
    price: l.price,
  }));

  const timeline: [string, Date | null][] = [
    ["Booked", o.bookedAt],
    ["Approved", o.approvedAt],
    ["Packed", o.packedAt],
    ["Dispatched", o.dispatchedAt],
    [o.status === "partially_delivered" ? "Part delivered" : "Delivered", o.deliveredAt],
  ];
  if (o.cancelledAt) timeline.push(["Cancelled", o.cancelledAt]);

  return (
    <>
      <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft size={15} /> Back
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Order #{o.orderNo}</h1>
        <StatusBadge status={o.status} />
        <span className="text-sm text-gray-500">
          by {d.salesman} · {dateTime(o.bookedAt)}
          {d.warehouse && <> · from {d.warehouse}</>}
        </span>
      </div>

      <div className="space-y-2">
        {r.status === "pending" && o.status === "booked" && (
          <Alert tone="amber">
            <b>New shop added by the salesman.</b>{" "}
            {isAdmin ? (
              <Link href={`/admin/retailers/${r.id}`} className="font-semibold underline">
                Approve the shop
              </Link>
            ) : (
              "The office must approve the shop"
            )}{" "}
            before this order can be approved.
          </Alert>
        )}
        {o.creditFlag && o.status === "booked" && r.status !== "pending" && (
          <Alert tone="red">
            <b>Credit check:</b> {o.flagNote ?? "Retailer is over credit limit or has overdue dues."}
          </Alert>
        )}
        {o.priceFlag && o.status === "booked" && (
          <Alert tone="amber">Prices changed after the salesman&apos;s phone last synced. Check line prices before approving.</Alert>
        )}
        {o.notes && <Alert tone="blue">Note from salesman: {o.notes}</Alert>}
        {o.cancelReason && <Alert tone="red">Cancelled: {o.cancelReason}</Alert>}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {o.status === "booked" && isAdmin ? (
            <Card>
              <CardHeader title="Approve order" sub="Check stock, adjust quantities, then approve to reserve stock." />
              <ApproveForm
                orderId={o.id}
                lines={formLines}
                warehouses={d.warehouses}
                defaultWarehouseId={o.warehouseId ?? r.defaultWarehouseId ?? d.warehouses[0]?.id ?? ""}
                availability={d.availability}
              />
            </Card>
          ) : canDeliver ? (
            <Card>
              <CardHeader title="Record delivery" sub="Change quantities if the retailer took less. The rest returns to stock." />
              <DeliverForm orderId={o.id} lines={formLines} outstanding={d.balance.outstanding} />
            </Card>
          ) : (
            <Card>
              <CardHeader
                title="Items"
                action={
                  canPack ? (
                    <PackForm orderId={o.id} />
                  ) : undefined
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Product</th>
                      <th className="px-4 py-2">Ordered</th>
                      <th className="px-4 py-2">Approved</th>
                      {["delivered", "partially_delivered"].includes(o.status) && <th className="px-4 py-2">Delivered</th>}
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l) => {
                      const shownQty = l.deliveredQty ?? l.approvedQty ?? l.qty;
                      const picks = d.picks.filter((p) => p.lineId === l.id);
                      return (
                        <tr key={l.id} className="border-t border-gray-100 align-top">
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{l.name}</div>
                            <div className="text-xs text-gray-500">
                              {money(l.price)}/{l.unit}
                              {l.priceSource !== "base" && (
                                <Badge tone="violet" className="ml-1.5">
                                  {l.priceSource === "retailer" ? "special" : "type"} price
                                </Badge>
                              )}
                            </div>
                            {showPicks && picks.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {picks.map((p, i) => {
                                  const days = daysUntil(p.expiry);
                                  return (
                                    <span
                                      key={i}
                                      className={cn(
                                        "rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-700",
                                        days != null && days <= 30 && "bg-amber-100 text-amber-900",
                                      )}
                                    >
                                      Batch {p.batchNo} · {qtyLabel(p.qty, l.caseSize, l.unit)}
                                      {p.expiry && ` · exp ${p.expiry}`}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">{qtyLabel(l.qty, l.caseSize, l.unit)}</td>
                          <td className={cn("px-4 py-2.5 whitespace-nowrap", l.approvedQty != null && l.approvedQty < l.qty && "text-amber-700")}>
                            {l.approvedQty == null ? "—" : qtyLabel(l.approvedQty, l.caseSize, l.unit)}
                          </td>
                          {["delivered", "partially_delivered"].includes(o.status) && (
                            <td className={cn("px-4 py-2.5 whitespace-nowrap", (l.deliveredQty ?? 0) < (l.approvedQty ?? 0) && "text-amber-700")}>
                              {qtyLabel(l.deliveredQty ?? 0, l.caseSize, l.unit)}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-right tabular-nums">{money(shownQty * l.price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 font-semibold">
                      <td className="px-4 py-2.5" colSpan={["delivered", "partially_delivered"].includes(o.status) ? 4 : 3}>
                        {o.deliveredTotal != null ? "Delivered total" : o.approvedAt ? "Approved total" : "Order total"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {money(
                          o.deliveredTotal ??
                            d.lines.reduce((s, l) => s + (l.approvedQty ?? l.qty) * l.price, 0),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {canDispatch && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <DispatchForm orderId={o.id} people={d.deliveryPeople} />
                </div>
              )}
            </Card>
          )}

          {canCancel && (
            <Card className="px-4 py-3">
              <CancelForm orderId={o.id} />
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title={
                isAdmin ? (
                  <Link href={`/admin/retailers/${r.id}`} className="hover:text-brand-700">
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )
              }
              sub={r.ownerName}
            />
            <div className="space-y-2 px-4 py-3 text-sm">
              {r.phone && (
                <a href={`tel:${r.phone}`} className="flex items-center gap-2 text-brand-700">
                  <Phone size={14} /> {r.phone}
                </a>
              )}
              {(r.address || r.area) && (
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <span>{[r.address, r.area].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {o.lat != null && o.lng != null && (
                <a
                  className="block text-xs text-gray-500 underline"
                  href={`https://maps.google.com/?q=${o.lat},${o.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Location where order was booked
                </a>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-y-1 border-t border-gray-100 pt-2">
                <dt className="text-gray-500">Outstanding</dt>
                <dd className="text-right font-medium tabular-nums">{money(d.balance.outstanding)}</dd>
                <dt className="text-gray-500">Overdue</dt>
                <dd className={cn("text-right tabular-nums", d.balance.overdue > 0 && "font-medium text-red-700")}>
                  {money(d.balance.overdue)}
                </dd>
                <dt className="text-gray-500">Credit limit</dt>
                <dd className="text-right tabular-nums">{r.creditLimit == null ? "No limit" : money(r.creditLimit)}</dd>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <ol className="space-y-2 px-4 py-3 text-sm">
              {timeline.map(([label, at]) => (
                <li key={label} className="flex items-center justify-between">
                  <span className={cn("flex items-center gap-2", at ? "text-gray-900" : "text-gray-400")}>
                    <span className={cn("h-2 w-2 rounded-full", at ? (label === "Cancelled" ? "bg-red-500" : "bg-emerald-500") : "bg-gray-300")} />
                    {label}
                  </span>
                  <span className="text-gray-500">{at ? dateTime(at) : ""}</span>
                </li>
              ))}
              {d.deliveryPerson && <li className="pt-1 text-xs text-gray-500">Delivery: {d.deliveryPerson}</li>}
            </ol>
          </Card>

          {d.payments.length > 0 && (
            <Card>
              <CardHeader title="Payments on this order" />
              <ul className="divide-y divide-gray-100 text-sm">
                {d.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-2">
                    <span>
                      {MODE_LABEL[p.mode]} · {p.collectedBy}
                      {p.status === "with_staff" && (
                        <Badge tone="amber" className="ml-1.5">
                          with staff
                        </Badge>
                      )}
                    </span>
                    <span className="font-medium tabular-nums">{money(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
