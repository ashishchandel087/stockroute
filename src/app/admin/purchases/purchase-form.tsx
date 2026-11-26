"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Combobox } from "@/components/combobox";
import { QtyInput } from "@/components/qty-input";
import { Card, CardHeader, Field } from "@/components/ui";
import { money, toPaise } from "@/lib/format";
import { createPurchase } from "../actions";

type P = { id: string; name: string; sku: string; unit: string; caseSize: number };
type Line = { key: number; productId: string; batchNo: string; expiry: string; qty: number; rate: string };

let k = 0;
const blank = (): Line => ({ key: ++k, productId: "", batchNo: "", expiry: "", qty: 0, rate: "" });

export function PurchaseForm({
  products,
  warehouses,
  suppliers,
}: {
  products: P[];
  warehouses: { id: string; name: string }[];
  suppliers: string[];
}) {
  const [lines, setLines] = useState<Line[]>([blank()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const options = products.map((p) => ({ id: p.id, label: p.name, sub: p.sku }));
  const set = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const payload = lines
    .filter((l) => l.productId && l.qty > 0)
    .map((l) => ({ productId: l.productId, batchNo: l.batchNo, expiry: l.expiry || null, qty: l.qty, rate: toPaise(l.rate) ?? 0 }));
  const total = payload.reduce((s, l) => s + l.qty * l.rate, 0);

  return (
    <ActionForm action={createPurchase} className="space-y-4">
      <Card>
        <CardHeader title="Supplier invoice" />
        <div className="grid gap-3 p-4 sm:grid-cols-4">
          <Field label="Supplier *" className="sm:col-span-2">
            <input name="supplier" list="suppliers" required className="input" placeholder="Type or pick" />
            <datalist id="suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Received at *">
            <select name="warehouseId" className="input" defaultValue={warehouses[0]?.id}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <div />
          <Field label="Invoice no.">
            <input name="invoiceNo" className="input" />
          </Field>
          <Field label="Invoice date">
            <input name="invoiceDate" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <input name="notes" className="input" />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Items received" sub="Rate is your cost per piece" />
        <div className="divide-y divide-gray-100">
          {lines.map((l, i) => {
            const p = byId.get(l.productId);
            return (
              <div key={l.key} className="grid gap-2 p-4 md:grid-cols-12 md:items-end">
                <Field label={`Item ${i + 1}`} className="md:col-span-4">
                  <Combobox options={options} placeholder="Search product…" onSelect={(o) => set(l.key, { productId: o?.id ?? "" })} />
                </Field>
                <Field label="Batch no." className="md:col-span-2">
                  <input value={l.batchNo} onChange={(e) => set(l.key, { batchNo: e.target.value })} className="input uppercase" />
                </Field>
                <Field label="Expiry" className="md:col-span-2">
                  <input type="date" value={l.expiry} onChange={(e) => set(l.key, { expiry: e.target.value })} className="input" />
                </Field>
                <Field label="Qty" className="md:col-span-2">
                  <QtyInput key={l.productId} compact caseSize={p?.caseSize ?? 1} unit={p?.unit ?? "pc"} onChange={(q) => set(l.key, { qty: q })} />
                </Field>
                <div className="flex items-end gap-2 md:col-span-2">
                  <Field label="Rate ₹/pc" className="flex-1">
                    <input value={l.rate} inputMode="decimal" onChange={(e) => set(l.key, { rate: e.target.value })} className="input h-8 text-sm" />
                  </Field>
                  <button
                    type="button"
                    onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : ls))}
                    className="mb-0.5 rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className="inline-flex items-center gap-1 text-sm font-medium text-brand-700">
            <Plus size={16} /> Add item
          </button>
          <div className="text-sm">
            Total <span className="ml-1 text-base font-semibold">{money(total)}</span>
          </div>
        </div>
      </Card>
      <input type="hidden" name="lines" value={JSON.stringify(payload)} />
      <SubmitButton size="lg">Save purchase & add stock</SubmitButton>
    </ActionForm>
  );
}
