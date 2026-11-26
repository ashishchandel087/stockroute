"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./form-bits";
import { QtyInput } from "./qty-input";
import { money, qtyLabel } from "@/lib/format";
import { approveAction, cancelAction, deliverAction, dispatchAction, packAction } from "@/app/actions/orders";
import { cn } from "./ui";

type Line = {
  id: string;
  productId: string;
  name: string;
  unit: string;
  caseSize: number;
  qty: number;
  approvedQty: number | null;
  price: number;
};

export function ApproveForm({
  orderId,
  lines,
  warehouses,
  defaultWarehouseId,
  availability,
}: {
  orderId: string;
  lines: Line[];
  warehouses: { id: string; name: string }[];
  defaultWarehouseId: string;
  availability: Record<string, Record<string, number>>;
}) {
  const [wh, setWh] = useState(defaultWarehouseId);
  const avail = availability[wh] ?? {};
  const initial = () => Object.fromEntries(lines.map((l) => [l.id, Math.max(0, Math.min(l.qty, avail[l.productId] ?? 0))]));
  const [qtys, setQtys] = useState<Record<string, number>>(initial);
  const total = lines.reduce((s, l) => s + (qtys[l.id] ?? 0) * l.price, 0);
  const short = lines.filter((l) => (avail[l.productId] ?? 0) < l.qty).length;

  return (
    <ActionForm action={approveAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap items-end gap-3 px-4 pt-4">
        <label className="block">
          <span className="label">Ship from</span>
          <select
            name="warehouseId"
            value={wh}
            onChange={(e) => {
              setWh(e.target.value);
              const a = availability[e.target.value] ?? {};
              setQtys(Object.fromEntries(lines.map((l) => [l.id, Math.max(0, Math.min(l.qty, a[l.productId] ?? 0))])));
            }}
            className="input h-10 w-56"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {short > 0 && (
          <p className="pb-2 text-sm text-amber-700">
            {short} item{short > 1 ? "s" : ""} short in this warehouse. Approve what is available or switch warehouse.
          </p>
        )}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Ordered</th>
              <th className="px-4 py-2">Available</th>
              <th className="px-4 py-2">Approve</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const a = avail[l.productId] ?? 0;
              return (
                <tr key={wh + l.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-gray-500">
                      {money(l.price)} / {l.unit}
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{qtyLabel(l.qty, l.caseSize, l.unit)}</td>
                  <td className={cn("px-4 py-2 whitespace-nowrap", a < l.qty ? "font-medium text-red-700" : "text-gray-600")}>
                    {qtyLabel(Math.max(0, a), l.caseSize, l.unit)}
                  </td>
                  <td className="px-4 py-2">
                    <QtyInput
                      compact
                      name={`qty_${l.id}`}
                      caseSize={l.caseSize}
                      unit={l.unit}
                      defaultValue={qtys[l.id]}
                      max={Math.min(l.qty, Math.max(0, a))}
                      onChange={(v) => setQtys((s) => ({ ...s, [l.id]: v }))}
                    />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{money((qtys[l.id] ?? 0) * l.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
        <div className="text-sm text-gray-600">
          Approved value <span className="ml-1 text-base font-semibold text-gray-900">{money(total)}</span>
        </div>
        <SubmitButton variant="success" pendingText="Approving…">
          Approve & reserve stock
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PackForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={packAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton pendingText="Picking batches…">Mark as packed</SubmitButton>
    </ActionForm>
  );
}

export function DispatchForm({ orderId, people }: { orderId: string; people: { id: string; name: string }[] }) {
  return (
    <ActionForm action={dispatchAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="block">
        <span className="label">Delivery by</span>
        <select name="deliveryPersonId" required className="input h-10 w-56" defaultValue={people.length === 1 ? people[0].id : ""}>
          <option value="" disabled>
            Choose person…
          </option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton pendingText="Dispatching…">Dispatch</SubmitButton>
    </ActionForm>
  );
}

export function DeliverForm({ orderId, lines, outstanding }: { orderId: string; lines: Line[]; outstanding: number }) {
  const [qtys, setQtys] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.approvedQty ?? 0])),
  );
  const [mode, setMode] = useState("cash");
  const total = lines.reduce((s, l) => s + (qtys[l.id] ?? 0) * l.price, 0);
  return (
    <ActionForm action={deliverAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="divide-y divide-gray-100">
        {lines
          .filter((l) => (l.approvedQty ?? 0) > 0)
          .map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-gray-500">
                  Sent {qtyLabel(l.approvedQty ?? 0, l.caseSize, l.unit)} · {money(l.price)}/{l.unit}
                </div>
              </div>
              <QtyInput
                compact
                name={`qty_${l.id}`}
                caseSize={l.caseSize}
                unit={l.unit}
                defaultValue={l.approvedQty ?? 0}
                max={l.approvedQty ?? 0}
                onChange={(v) => setQtys((s) => ({ ...s, [l.id]: v }))}
              />
            </div>
          ))}
      </div>
      <div className="space-y-3 border-t border-gray-100 px-4 py-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Delivered value</span>
          <span className="text-base font-semibold">{money(total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Old balance</span>
          <span>{money(outstanding)}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="label">Payment received (₹)</span>
            <input name="amount" inputMode="decimal" placeholder="0 if on credit" className="input h-10" />
          </label>
          <label className="block">
            <span className="label">Mode</span>
            <select name="mode" value={mode} onChange={(e) => setMode(e.target.value)} className="input h-10">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="bank">Bank transfer</option>
            </select>
          </label>
          {mode !== "cash" && (
            <label className="block">
              <span className="label">{mode === "cheque" ? "Cheque no." : "Txn ref / UTR"}</span>
              <input name="reference" className="input h-10" />
            </label>
          )}
        </div>
        <SubmitButton variant="success" size="lg" className="w-full sm:w-auto" pendingText="Saving…">
          Confirm delivery
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CancelForm({ orderId }: { orderId: string }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm font-medium text-red-700 hover:underline">Cancel order…</summary>
      <ActionForm action={cancelAction} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        <label className="block flex-1">
          <span className="label">Reason</span>
          <input name="reason" required placeholder="e.g. retailer cancelled, duplicate" className="input h-10" />
        </label>
        <SubmitButton variant="danger" pendingText="Cancelling…" confirm="Cancel this order? Reserved stock will be released.">
          Cancel order
        </SubmitButton>
      </ActionForm>
    </details>
  );
}
