"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Minus, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { cn } from "@/components/ui";
import { buildPriceTables, resolvePrice } from "@/lib/pricing";
import { dateTime, money, qtyLabel } from "@/lib/format";
import type { Catalog, CatalogProduct, CatalogRetailer } from "@/lib/sync-types";
import { BigButton, Card, Chip, Chips, SearchBox, Sheet, StatusChip, matchAll } from "../ui";
import { canChange, type AppOrder } from "../derive";
import { CreditWarnings } from "./shops";

export type Cart = { items: Record<string, number>; notes: string };
type Prices = ReturnType<typeof buildPriceTables>;

export function cartTotal(cart: Cart | undefined, r: CatalogRetailer, productById: Map<string, CatalogProduct>, prices: Prices) {
  return Object.entries(cart?.items ?? {}).reduce((s, [pid, qty]) => {
    const p = productById.get(pid);
    return p ? s + qty * resolvePrice(p, r, prices).price : s;
  }, 0);
}

// ------------------------------------------------------------------ order pad
export function OrderPad({
  r,
  catalog,
  prices,
  cart,
  editingNo,
  setQty,
  onReview,
}: {
  r: CatalogRetailer;
  catalog: Catalog;
  prices: Prices;
  cart: Cart;
  editingNo?: number | null;
  setQty: (productId: string, pieces: number) => void;
  onReview: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const cats = useMemo(() => [...new Set(catalog.products.map((p) => p.category).filter(Boolean) as string[])].sort(), [catalog.products]);
  const productById = useMemo(() => new Map(catalog.products.map((p) => [p.id, p])), [catalog.products]);
  const list = catalog.products.filter(
    (p) =>
      (cat === "__cart" ? !!cart.items[p.id] : !cat || p.category === cat) &&
      (!q || matchAll(`${p.name} ${p.brand ?? ""} ${p.sku} ${p.category ?? ""}`, q)),
  );
  const shown = list.slice(0, 120);
  const items = Object.keys(cart.items).length;
  const total = cartTotal(cart, r, productById, prices);

  return (
    <div className="space-y-3 p-3">
      {editingNo !== undefined && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
          Changing {editingNo ? `order #${editingNo}` : "your unsent order"}. Review to save the changes.
        </div>
      )}
      <div className="sticky top-14 z-20 -mx-3 space-y-2 bg-[#f5f6f8] px-3 pb-2 pt-1">
        <SearchBox value={q} onChange={setQ} placeholder="Search product, brand, SKU…" />
        <Chips
          value={cat}
          onChange={setCat}
          items={[{ k: "", l: "All" }, ...(items ? [{ k: "__cart", l: `In cart (${items})` }] : []), ...cats.map((c) => ({ k: c, l: c }))]}
        />
      </div>

      <Card>
        <ul>
          {shown.map((p) => {
            const { price, source } = resolvePrice(p, r, prices);
            const qty = cart.items[p.id] ?? 0;
            const step = p.caseSize > 1 ? p.caseSize : 1;
            return (
              <li key={p.id} className={cn("flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 last:border-0", qty > 0 && "bg-brand-50/50")}>
                <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(p)}>
                  <div className="text-[15px] font-medium leading-snug text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">
                    <span className={cn("font-semibold", source !== "base" ? "text-violet-700" : "text-gray-800")}>{money(price)}</span>/{p.unit}
                    {p.mrp > 0 && <span> · MRP {money(p.mrp)}</span>}
                    {p.caseSize > 1 && <span> · {p.caseSize}/cs</span>}
                  </div>
                  {qty > 0 && (
                    <div className="mt-0.5 text-xs font-semibold text-brand-700">
                      {qtyLabel(qty, p.caseSize, p.unit)} · {money(qty * price)}
                    </div>
                  )}
                </button>
                {qty > 0 ? (
                  <div className="flex items-center rounded-full border border-brand-200 bg-white">
                    <button onClick={() => setQty(p.id, Math.max(0, qty - step))} className="flex h-10 w-10 items-center justify-center text-brand-700" aria-label="Less">
                      <Minus size={18} />
                    </button>
                    <button onClick={() => setEditing(p)} className="min-w-10 text-center text-sm font-semibold tabular-nums">
                      {p.caseSize > 1 && qty % p.caseSize === 0 ? `${qty / p.caseSize}cs` : qty}
                    </button>
                    <button onClick={() => setQty(p.id, qty + step)} className="flex h-10 w-10 items-center justify-center text-brand-700" aria-label="More">
                      <Plus size={18} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setQty(p.id, step)}
                    className="flex h-10 items-center gap-1 rounded-full border border-gray-300 px-3 text-sm font-medium text-gray-800 active:bg-gray-100"
                  >
                    <Plus size={16} /> {p.caseSize > 1 ? "1 cs" : "Add"}
                  </button>
                )}
              </li>
            );
          })}
          {list.length > shown.length && (
            <li className="p-3 text-center text-xs text-gray-500">
              Showing {shown.length} of {list.length}. Type to narrow down.
            </li>
          )}
          {list.length === 0 && <li className="p-6 text-center text-sm text-gray-500">No products match.</li>}
        </ul>
      </Card>

      {items > 0 && (
        <div className="fixed inset-x-0 bottom-[60px] z-30 mx-auto max-w-md px-3 pb-[env(safe-area-inset-bottom)]">
          <button onClick={onReview} className="flex h-14 w-full items-center justify-between rounded-xl bg-emerald-600 px-4 text-white shadow-lg active:bg-emerald-700">
            <span className="text-sm">
              {items} item{items > 1 ? "s" : ""} · <b className="text-base">{money(total)}</b>
            </span>
            <span className="flex items-center gap-1 font-semibold">
              Review <ChevronRight size={18} />
            </span>
          </button>
        </div>
      )}

      {editing && (
        <QtySheet
          p={editing}
          price={resolvePrice(editing, r, prices).price}
          value={cart.items[editing.id] ?? 0}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            setQty(editing.id, v);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function QtySheet({
  p,
  price,
  value,
  onSave,
  onClose,
}: {
  p: CatalogProduct;
  price: number;
  value: number;
  onSave: (pieces: number) => void;
  onClose: () => void;
}) {
  const hasCase = p.caseSize > 1;
  const [cs, setCs] = useState(hasCase ? Math.floor(value / p.caseSize) : 0);
  const [pc, setPc] = useState(hasCase ? value % p.caseSize : value);
  const total = cs * (hasCase ? p.caseSize : 0) + pc;
  return (
    <Sheet onClose={onClose}>
      <div className="font-semibold">{p.name}</div>
      <div className="text-sm text-gray-500">
        {money(price)}/{p.unit}
        {hasCase && ` · ${p.caseSize} ${p.unit} per case`}
      </div>
      <div className={cn("my-5 grid gap-4", hasCase ? "grid-cols-2" : "grid-cols-1")}>
        {hasCase && <Stepper label="Cases" v={cs} set={setCs} />}
        <Stepper label={hasCase ? `Loose ${p.unit}` : p.unit} v={pc} set={setPc} />
      </div>
      {hasCase && (
        <div className="mb-4 flex justify-center gap-2">
          {[1, 2, 5, 10].map((n) => (
            <button key={n} onClick={() => setCs(cs + n)} className="rounded-full border border-gray-300 px-3 py-1.5 text-sm active:bg-gray-100">
              +{n} cs
            </button>
          ))}
        </div>
      )}
      <div className="mb-3 text-center text-sm text-gray-600">
        {total > 0 ? (
          <>
            {qtyLabel(total, p.caseSize, p.unit)} = <b>{total} {p.unit}</b> · {money(total * price)}
          </>
        ) : (
          "Not in order"
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <BigButton variant="secondary" onClick={() => onSave(0)}>
          {value > 0 ? "Remove" : "Cancel"}
        </BigButton>
        <BigButton onClick={() => onSave(total)}>Done</BigButton>
      </div>
    </Sheet>
  );
}

function Stepper({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  return (
    <div>
      <div className="mb-1 text-center text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => set(Math.max(0, v - 1))} className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200">
          <Minus size={20} />
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={v || ""}
          placeholder="0"
          onChange={(e) => set(Math.max(0, parseInt(e.target.value || "0", 10) || 0))}
          className="h-12 w-20 rounded-xl border border-gray-300 text-center text-xl font-semibold outline-none focus:border-brand-500"
        />
        <button onClick={() => set(v + 1)} className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200">
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ review
export function ReviewView({
  r,
  productById,
  prices,
  cart,
  pendingTotal,
  editing,
  setQty,
  setNotes,
  onAddMore,
  onPlace,
}: {
  r: CatalogRetailer;
  productById: Map<string, CatalogProduct>;
  prices: Prices;
  cart: Cart;
  pendingTotal: number;
  editing: boolean;
  setQty: (pid: string, q: number) => void;
  setNotes: (n: string) => void;
  onAddMore: () => void;
  onPlace: () => Promise<void>;
}) {
  const [placing, setPlacing] = useState(false);
  const lines = Object.entries(cart.items)
    .map(([pid, qty]) => {
      const p = productById.get(pid);
      return p ? { p, qty, price: resolvePrice(p, r, prices).price } : null;
    })
    .filter(Boolean) as { p: CatalogProduct; qty: number; price: number }[];
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  if (!lines.length) {
    return (
      <div className="space-y-3 p-6 text-center text-gray-500">
        <p>The cart is empty.</p>
        <BigButton variant="secondary" onClick={onAddMore}>
          Add products
        </BigButton>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-3">
      <CreditWarnings r={r} extra={total + pendingTotal} />
      <Card>
        <ul>
          {lines.map(({ p, qty, price }) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500">
                  {qtyLabel(qty, p.caseSize, p.unit)} × {money(price)}
                </div>
              </div>
              <div className="text-right font-semibold tabular-nums">{money(qty * price)}</div>
              <button onClick={() => setQty(p.id, 0)} className="p-2 text-gray-400 active:text-red-600" aria-label="Remove">
                <Trash2 size={18} />
              </button>
            </li>
          ))}
          <li className="flex justify-between bg-gray-50 px-4 py-3 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(total)}</span>
          </li>
        </ul>
      </Card>
      <button onClick={onAddMore} className="text-sm font-medium text-brand-700">
        + Add more products
      </button>
      <textarea
        value={cart.notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note for office (optional): delivery timing, scheme promised…"
        rows={2}
        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-brand-500"
      />
      <button
        disabled={placing}
        onClick={async () => {
          setPlacing(true);
          try {
            await onPlace();
          } finally {
            setPlacing(false);
          }
        }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-lg font-semibold text-white active:bg-emerald-700 disabled:opacity-60"
      >
        <Check size={22} /> {placing ? "Saving…" : `${editing ? "Save changes" : "Place order"} · ${money(total)}`}
      </button>
      <p className="text-center text-xs text-gray-500">Saved on the phone first, then uploaded automatically.</p>
    </div>
  );
}

// ------------------------------------------------------------------ order list & detail
export function OrdersView({
  orders,
  otherPending,
  onOpen,
  onDiscard,
}: {
  orders: AppOrder[];
  otherPending: { id: string; label: string; amount?: number; error?: string }[];
  onOpen: (id: string) => void;
  onDiscard: (id: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const shown = orders.filter((o) => (filter === "open" ? canChange(o) || o.unsynced : filter === "done" ? !canChange(o) : true));
  return (
    <div className="space-y-3 p-3">
      {otherPending.length > 0 && (
        <Card className="border-amber-200">
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">Waiting to upload</div>
          <ul className="divide-y divide-gray-100 text-sm">
            {otherPending.map((p) => (
              <li key={p.id} className="px-4 py-2.5">
                <div className="flex justify-between">
                  <span>{p.label}</span>
                  {p.amount != null && <span className="tabular-nums">{money(p.amount)}</span>}
                </div>
                {p.error && <PendingError error={p.error} onDiscard={() => onDiscard(p.id)} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Chips
        value={filter}
        onChange={setFilter}
        items={[
          { k: "", l: "All" },
          { k: "open", l: "Can change" },
          { k: "done", l: "Approved & later" },
        ]}
      />
      {shown.length === 0 ? (
        <Card className="p-6 text-center text-sm text-gray-500">No orders.</Card>
      ) : (
        <Card>
          <ul>
            {shown.map((o) => (
              <li key={o.id} className="border-b border-gray-100 last:border-0">
                <button onClick={() => onOpen(o.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-gray-50">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{o.retailerName}</div>
                    <div className="text-xs text-gray-500">
                      {o.orderNo ? `#${o.orderNo}` : "New"} · {o.lines.length} items · {dateTime(o.bookedAt)}
                    </div>
                    {o.error && <div className="mt-0.5 text-xs text-red-700">Not accepted: {o.error}</div>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{money(o.deliveredTotal ?? o.total)}</div>
                    <OrderChip o={o} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function OrderChip({ o }: { o: AppOrder }) {
  if (o.pendingCancel) return <Chip tone="red">Cancelling…</Chip>;
  if (o.unsynced) return <Chip tone="amber">Not uploaded</Chip>;
  if (o.pendingEdit) return <Chip tone="amber">Changes not uploaded</Chip>;
  return <StatusChip status={o.status} />;
}

function PendingError({ error, onDiscard }: { error: string; onDiscard: () => void }) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-700">
      <span>Not accepted: {error}</span>
      <button onClick={() => confirm("Discard this from the phone?") && onDiscard()} className="shrink-0 font-semibold underline">
        Discard
      </button>
    </div>
  );
}

export function OrderDetail({
  o,
  productById,
  onEdit,
  onCancel,
  onRepeat,
  onDiscardError,
}: {
  o: AppOrder;
  productById: Map<string, CatalogProduct>;
  onEdit: () => void;
  onCancel: (reason: string) => Promise<void>;
  onRepeat: () => void;
  onDiscardError: () => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const editable = canChange(o);
  return (
    <div className="space-y-3 p-3">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">{o.orderNo ? `Order #${o.orderNo}` : "New order"}</div>
            <div className="text-sm text-gray-500">
              {o.retailerName} · {dateTime(o.bookedAt)}
            </div>
          </div>
          <OrderChip o={o} />
        </div>
        {o.notes && <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">Note: {o.notes}</div>}
        {o.error && <PendingError error={o.error} onDiscard={onDiscardError} />}
      </Card>
      <Card>
        <ul>
          {o.lines.map((l) => {
            const p = productById.get(l.productId);
            return (
              <li key={l.productId} className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="font-medium">{p?.name ?? "Product removed"}</div>
                  <div className="text-xs text-gray-500">
                    {p ? qtyLabel(l.qty, p.caseSize, p.unit) : `${l.qty} pcs`} × {money(l.price)}
                  </div>
                </div>
                <div className="tabular-nums">{money(l.qty * l.price)}</div>
              </li>
            );
          })}
          <li className="flex justify-between bg-gray-50 px-4 py-3 font-semibold">
            <span>{o.deliveredTotal != null ? "Delivered total" : "Total"}</span>
            <span className="tabular-nums">{money(o.deliveredTotal ?? o.total)}</span>
          </li>
        </ul>
      </Card>

      {editable ? (
        <div className="grid grid-cols-2 gap-2">
          <BigButton onClick={onEdit}>
            <Pencil size={18} /> Change items
          </BigButton>
          <BigButton variant="danger" onClick={() => setCancelling(true)}>
            <XCircle size={18} /> Cancel order
          </BigButton>
        </div>
      ) : (
        !o.pendingCancel &&
        o.status !== "cancelled" && (
          <p className="px-2 text-center text-xs text-gray-500">
            This order is already {o.status.replace("_", " ")}. Call the office to change it.
          </p>
        )
      )}
      <BigButton variant="secondary" onClick={onRepeat}>
        Order the same again
      </BigButton>

      {cancelling && (
        <Sheet onClose={() => setCancelling(false)}>
          <div className="mb-2 font-semibold">Cancel {o.orderNo ? `order #${o.orderNo}` : "this order"}?</div>
          <div className="mb-3 flex flex-wrap gap-2">
            {["Retailer cancelled", "Wrong items", "Duplicate order", "Shop closed"].map((x) => (
              <button
                key={x}
                onClick={() => setReason(x)}
                className={cn("rounded-full border px-3 py-1.5 text-sm", reason === x ? "border-brand-600 bg-brand-600 text-white" : "border-gray-300")}
              >
                {x}
              </button>
            ))}
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            className="mb-3 h-12 w-full rounded-xl border border-gray-300 px-3 outline-none focus:border-brand-500"
          />
          <BigButton
            variant="danger"
            disabled={!reason.trim()}
            onClick={async () => {
              await onCancel(reason.trim());
              setCancelling(false);
            }}
          >
            Yes, cancel order
          </BigButton>
        </Sheet>
      )}
    </div>
  );
}

export function DoneView({
  title,
  r,
  online,
  waiting,
  onNext,
  onShop,
}: {
  title: string;
  r: CatalogRetailer;
  online: boolean;
  waiting: boolean;
  onNext: () => void;
  onShop: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check size={34} />
      </div>
      <div className="text-xl font-semibold">{title}</div>
      <p className="text-sm text-gray-600">
        {r.name}.{" "}
        {!waiting ? "Uploaded to the office ✓" : online ? "Uploading now…" : "You are offline. It will upload automatically when internet is back."}
      </p>
      <div className="mt-4 w-full space-y-2">
        <BigButton onClick={onNext}>Next shop</BigButton>
        <BigButton variant="secondary" onClick={onShop}>
          Back to {r.name}
        </BigButton>
      </div>
    </div>
  );
}
