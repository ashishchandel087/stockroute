"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/form-bits";
import { Combobox } from "@/components/combobox";
import { QtyInput } from "@/components/qty-input";
import { Alert, Card, CardHeader, Field } from "@/components/ui";
import { buildPriceTables, resolvePrice } from "@/lib/pricing";
import { money } from "@/lib/format";
import { createOfficeOrder } from "../../actions";

type Shop = { id: string; name: string; area: string | null; typeId: string | null; status: string; outstanding: number; overdue: number; creditLimit: number | null };
type Product = { id: string; name: string; sku: string; unit: string; caseSize: number; basePrice: number };

export function OfficeOrderForm({
  shops,
  products,
  typePrices,
  retailerPrices,
  bookers,
  meId,
}: {
  shops: Shop[];
  products: Product[];
  typePrices: { productId: string; typeId: string; price: number }[];
  retailerPrices: { productId: string; retailerId: string; price: number }[];
  bookers: { id: string; name: string }[];
  meId: string;
}) {
  const [shopId, setShopId] = useState("");
  const [lines, setLines] = useState<{ productId: string; qty: number }[]>([]);
  const [pickerKey, setPickerKey] = useState(0);
  const prices = useMemo(() => buildPriceTables(typePrices, retailerPrices), [typePrices, retailerPrices]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shop = shops.find((s) => s.id === shopId);
  const priceOf = (p: Product) => (shop ? resolvePrice(p, shop, prices) : { price: p.basePrice, source: "base" as const });
  const total = lines.reduce((s, l) => s + l.qty * priceOf(byId.get(l.productId)!).price, 0);

  return (
    <ActionForm action={createOfficeOrder} className="space-y-4">
      <Card>
        <CardHeader title="Shop" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Shop *">
            <Combobox
              name="retailerId"
              placeholder="Search shop…"
              options={shops.map((s) => ({ id: s.id, label: s.name, sub: [s.area, s.status === "pending" ? "new shop" : null].filter(Boolean).join(" · ") }))}
              onSelect={(o) => setShopId(o?.id ?? "")}
            />
          </Field>
          <Field label="Booked for" hint="Credit for the sale goes to this person">
            <select name="bookedBy" defaultValue={meId} className="input h-10">
              {bookers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id === meId ? `${b.name} (me)` : b.name}
                </option>
              ))}
            </select>
          </Field>
          {shop && (shop.overdue > 0 || (shop.creditLimit != null && shop.outstanding + total > shop.creditLimit)) && (
            <div className="sm:col-span-2">
              <Alert tone="red">
                Outstanding {money(shop.outstanding)}
                {shop.overdue > 0 && `, overdue ${money(shop.overdue)}`}
                {shop.creditLimit != null && ` · credit limit ${money(shop.creditLimit)}`}. The order will be flagged.
              </Alert>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Items" sub={shop ? "Prices for this shop (special and type prices applied)" : "Choose the shop first to see its prices"} />
        <div className="p-4">
          <Combobox
            key={pickerKey}
            placeholder="Add product: type name or SKU…"
            options={products.map((p) => ({ id: p.id, label: p.name, sub: `${p.sku} · ${money(priceOf(p).price)}/${p.unit}` }))}
            onSelect={(o) => {
              if (!o) return;
              const p = byId.get(o.id)!;
              setLines((ls) => (ls.some((l) => l.productId === o.id) ? ls : [...ls, { productId: o.id, qty: p.caseSize > 1 ? p.caseSize : 1 }]));
              setPickerKey((k) => k + 1);
            }}
          />
        </div>
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = byId.get(l.productId)!;
                  const { price, source } = priceOf(p);
                  return (
                    <tr key={l.productId} className="border-t border-gray-100">
                      <td className="px-4 py-2">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-500">
                          {money(price)}/{p.unit}
                          {source !== "base" && <span className="ml-1 text-violet-700">({source === "retailer" ? "special" : "type"} price)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <QtyInput
                          compact
                          caseSize={p.caseSize}
                          unit={p.unit}
                          defaultValue={l.qty}
                          onChange={(q) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, qty: q } : x)))}
                        />
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(l.qty * price)}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
          <span className="text-gray-500">{lines.length} items</span>
          <span>
            Total <b className="ml-1 text-base">{money(total)}</b>
          </span>
        </div>
      </Card>

      <Field label="Note (optional)">
        <input name="notes" className="input" placeholder="e.g. phoned in by owner, deliver tomorrow" />
      </Field>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <SubmitButton size="lg" pendingText="Booking…">
        Book order
      </SubmitButton>
    </ActionForm>
  );
}
