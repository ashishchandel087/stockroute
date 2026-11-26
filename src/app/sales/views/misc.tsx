"use client";

import { useMemo, useState } from "react";
import { LogOut, RefreshCw, Share2 } from "lucide-react";
import { cn } from "@/components/ui";
import { buildPriceTables, resolvePrice } from "@/lib/pricing";
import { money } from "@/lib/format";
import type { Catalog, CatalogRetailer, OutboxPayment } from "@/lib/sync-types";
import { toPaise } from "@/lib/format";
import { BigButton, Card, Chips, SearchBox, ago, matchAll } from "../ui";
import type { SyncState } from "../use-sales-store";

// ------------------------------------------------------------------ products & price list
export function ProductsView({ catalog }: { catalog: Catalog }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [typeId, setTypeId] = useState("");
  const prices = useMemo(() => buildPriceTables(catalog.typePrices, []), [catalog.typePrices]);
  const cats = useMemo(() => [...new Set(catalog.products.map((p) => p.category).filter(Boolean) as string[])].sort(), [catalog.products]);
  const list = catalog.products.filter(
    (p) => (!cat || p.category === cat) && (!q || matchAll(`${p.name} ${p.brand ?? ""} ${p.sku} ${p.category ?? ""}`, q)),
  );
  // Price list for a shop type (a dummy retailer with that type, no special prices)
  const asRetailer = { id: "__pricelist", typeId: typeId || null };
  const priceOf = (p: (typeof list)[number]) => resolvePrice(p, asRetailer, prices).price;
  const typeName = catalog.types.find((t) => t.id === typeId)?.name ?? "Standard";

  async function share() {
    const lines = list.slice(0, 150).map((p) => {
      const price = priceOf(p);
      const cs = p.caseSize > 1 ? ` · case of ${p.caseSize}: ${money(price * p.caseSize)}` : "";
      return `• ${p.name}: ${money(price)}/${p.unit}${p.mrp ? ` (MRP ${money(p.mrp)})` : ""}${cs}`;
    });
    const text = `*Price list${cat ? ` · ${cat}` : ""}* (${typeName})\n${new Date().toLocaleDateString("en-IN")}\n\n${lines.join("\n")}${list.length > 150 ? `\n…and ${list.length - 150} more` : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* user closed the share sheet */
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="space-y-3 p-3">
      <div className="sticky top-14 z-20 -mx-3 space-y-2 bg-[#f5f6f8] px-3 pb-2 pt-1">
        <SearchBox value={q} onChange={setQ} placeholder="Search product, brand, SKU…" />
        <div className="flex gap-2">
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none"
            aria-label="Prices for shop type"
          >
            <option value="">Prices: Standard</option>
            {catalog.types.map((t) => (
              <option key={t.id} value={t.id}>
                Prices: {t.name}
              </option>
            ))}
          </select>
          <button onClick={share} className="flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white active:bg-emerald-700">
            <Share2 size={16} /> Share
          </button>
        </div>
        <Chips value={cat} onChange={setCat} items={[{ k: "", l: "All" }, ...cats.map((c) => ({ k: c, l: c }))]} />
      </div>
      <Card>
        <ul>
          {list.slice(0, 200).map((p) => {
            const price = priceOf(p);
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium leading-snug">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    {p.sku}
                    {p.brand && ` · ${p.brand}`}
                    {p.caseSize > 1 && ` · ${p.caseSize} ${p.unit}/case`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn("font-semibold tabular-nums", price !== p.basePrice && "text-violet-700")}>
                    {money(price)}
                    <span className="text-xs font-normal text-gray-500">/{p.unit}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    MRP {money(p.mrp)}
                    {p.caseSize > 1 && ` · cs ${money(price * p.caseSize)}`}
                  </div>
                </div>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-6 text-center text-sm text-gray-500">No products match.</li>}
        </ul>
      </Card>
      <p className="px-2 text-center text-xs text-gray-500">Shops with special prices see their own rate when you take an order.</p>
    </div>
  );
}

// ------------------------------------------------------------------ collect payment
export function CollectView({
  r,
  onSave,
}: {
  r: CatalogRetailer;
  onSave: (p: Pick<OutboxPayment, "amount" | "mode" | "reference" | "notes">) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<OutboxPayment["mode"]>("cash");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const paise = toPaise(amount) ?? 0;
  return (
    <div className="space-y-4 p-3">
      <Card className="p-4 text-sm">
        Outstanding <b className="ml-1 tabular-nums">{money(r.outstanding)}</b>
        {r.overdue > 0 && <span className="ml-2 text-red-700">({money(r.overdue)} overdue)</span>}
      </Card>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Amount received (₹)</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          className="h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-2xl font-semibold outline-none focus:border-brand-500"
        />
      </label>
      {r.outstanding > 0 && (
        <button onClick={() => setAmount((r.outstanding / 100).toFixed(2))} className="text-sm font-medium text-brand-700">
          Full due: {money(r.outstanding)}
        </button>
      )}
      <div className="grid grid-cols-3 gap-2">
        {(["cash", "upi", "cheque"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "h-12 rounded-xl border font-medium",
              mode === m ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300 bg-white text-gray-700",
            )}
          >
            {m === "cash" ? "Cash" : m === "upi" ? "UPI" : "Cheque"}
          </button>
        ))}
      </div>
      {mode !== "cash" && (
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder={mode === "upi" ? "UPI ref / last 4 digits of UTR" : "Cheque number"}
          className="h-12 w-full rounded-xl border border-gray-300 bg-white px-4 outline-none focus:border-brand-500"
        />
      )}
      <BigButton
        variant="success"
        disabled={paise <= 0 || saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({ amount: paise, mode, reference: ref.trim() || null, notes: null });
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : `Save ${paise > 0 ? money(paise) : "payment"}`}
      </BigButton>
      {mode === "cash" && <p className="text-center text-xs text-gray-500">Hand over cash to the office. Admin will confirm receipt.</p>}
    </div>
  );
}

// ------------------------------------------------------------------ account
export function AccountView({
  catalog,
  sync,
  pending,
  shops,
  onSync,
  onLogout,
}: {
  catalog: Catalog;
  sync: SyncState;
  pending: number;
  shops: number;
  onSync: () => void;
  onLogout: () => Promise<void>;
}) {
  const today = new Date().toDateString();
  const todays = catalog.myOrders.filter((o) => new Date(o.bookedAt).toDateString() === today && o.status !== "cancelled");
  return (
    <div className="space-y-3 p-3">
      <Card className="p-4">
        <div className="text-lg font-semibold">{catalog.user.name}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] uppercase text-gray-500">Orders today</div>
            <div className="text-lg font-semibold">{todays.length}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2">
            <div className="text-[11px] uppercase text-gray-500">Value today</div>
            <div className="text-lg font-semibold tabular-nums">{money(todays.reduce((s, o) => s + o.total, 0))}</div>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <div>Last synced: {ago(sync.lastSync)}</div>
          <div>
            {catalog.products.length} products · {shops} shops on this phone
          </div>
          <div>{pending ? `${pending} entries waiting to upload` : "Everything uploaded"}</div>
          {sync.error && <div className="text-red-700">{sync.error}</div>}
        </div>
      </Card>
      <BigButton variant="secondary" onClick={onSync} disabled={sync.syncing}>
        <RefreshCw size={18} className={cn(sync.syncing && "animate-spin")} /> {sync.syncing ? "Syncing…" : "Sync now"}
      </BigButton>
      {catalog.user.role === "admin" && (
        <a href="/admin" className="flex h-12 items-center justify-center rounded-xl border border-gray-300 bg-white font-semibold text-gray-800">
          Open office screens
        </a>
      )}
      <BigButton
        variant="danger"
        onClick={() => {
          if (pending > 0) {
            alert("Some work is not uploaded yet. Connect to the internet and sync before logging out.");
            return;
          }
          if (confirm("Log out from this phone?")) onLogout();
        }}
      >
        <LogOut size={18} /> Log out
      </BigButton>
      <p className="px-2 text-xs text-gray-500">
        Tip: In Chrome, tap ⋮ → &quot;Add to Home screen&quot; to install StockRoute like an app. It works without internet after the first sync.
      </p>
    </div>
  );
}
