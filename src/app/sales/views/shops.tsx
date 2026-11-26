"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  Crosshair,
  IndianRupee,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Repeat,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { cn } from "@/components/ui";
import { dateTime, money } from "@/lib/format";
import type { Catalog, CatalogRetailer, OrderLineInput, ShopAccount, ShopFields } from "@/lib/sync-types";
import { BigButton, Card, Chip, Chips, SearchBox, StatusChip, ago, getPosition, mapsUrl, matchAll, photoToDataUrl } from "../ui";
import type { AppOrder } from "../derive";

// ------------------------------------------------------------------ list
export function ShopsView({
  retailers,
  cartCount,
  onOpen,
  onAdd,
}: {
  retailers: CatalogRetailer[];
  cartCount: (retailerId: string) => number;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const areas = useMemo(() => [...new Set(retailers.map((r) => r.area).filter(Boolean) as string[])].sort(), [retailers]);
  const list = retailers.filter(
    (r) =>
      (area === "__new" ? r.status === "pending" : !area || r.area === area) &&
      (!q || matchAll(`${r.name} ${r.ownerName ?? ""} ${r.area ?? ""} ${r.phone ?? ""}`, q)),
  );
  // Shops with an unfinished cart float to the top
  list.sort((a, b) => Number(cartCount(b.id) > 0) - Number(cartCount(a.id) > 0));
  const pendingCount = retailers.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-3 p-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBox value={q} onChange={setQ} placeholder="Search shop, owner, area…" />
        </div>
        <button
          onClick={onAdd}
          className="flex h-12 shrink-0 items-center gap-1 rounded-xl bg-brand-600 px-3 font-semibold text-white active:bg-brand-700"
        >
          <Plus size={18} /> Shop
        </button>
      </div>
      <Chips
        value={area}
        onChange={setArea}
        items={[
          { k: "", l: "All areas" },
          ...(pendingCount ? [{ k: "__new", l: `New shops (${pendingCount})` }] : []),
          ...areas.map((a) => ({ k: a, l: a })),
        ]}
      />
      <Card>
        <ul>
          {list.slice(0, 200).map((r) => {
            const inCart = cartCount(r.id);
            return (
              <li key={r.id} className="border-b border-gray-100 last:border-0">
                <button onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-gray-900">{r.name}</span>
                      {r.status === "pending" && <Chip tone="amber">New</Chip>}
                    </div>
                    <div className="truncate text-xs text-gray-500">{[r.ownerName, r.area].filter(Boolean).join(" · ")}</div>
                    {inCart > 0 && (
                      <div className="mt-0.5 text-xs font-medium text-brand-700">
                        <ShoppingCart size={11} className="mr-1 inline" />
                        Unfinished order · {inCart} items
                      </div>
                    )}
                  </div>
                  {r.outstanding > 0 && (
                    <div className={cn("text-right text-sm tabular-nums", r.overdue > 0 ? "text-red-700" : "text-gray-700")}>
                      {money(r.outstanding)}
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">{r.overdue > 0 ? "overdue" : "due"}</div>
                    </div>
                  )}
                  <ChevronRight size={18} className="shrink-0 text-gray-300" />
                </button>
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="p-6 text-center text-sm text-gray-500">
              No shops match.{" "}
              <button onClick={onAdd} className="font-medium text-brand-700">
                Add a new shop
              </button>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}

export function CreditWarnings({ r, extra = 0 }: { r: CatalogRetailer; extra?: number }) {
  if (r.status === "pending") {
    return (
      <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        New shop, waiting for office approval. You can still book orders; they will be processed after approval.
      </div>
    );
  }
  const over = r.creditLimit != null && r.outstanding + r.openOrders + extra > r.creditLimit;
  if (!over && r.overdue <= 0) return null;
  return (
    <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div>
        {r.overdue > 0 && <div>Overdue dues: {money(r.overdue)}. Please try to collect.</div>}
        {over && <div>Over credit limit ({money(r.creditLimit!)}). The order will still be booked but needs admin approval.</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ shop page
export function ShopView({
  r,
  catalog,
  orders,
  pendingCount,
  cartCount,
  photo,
  loadAccount,
  onOrder,
  onCollect,
  onEdit,
  onRepeat,
  onOpenOrder,
}: {
  r: CatalogRetailer;
  catalog: Catalog;
  orders: AppOrder[];
  pendingCount: number;
  cartCount: number;
  photo: string | null | undefined;
  loadAccount: (id: string, cb: (a: ShopAccount, fresh: boolean) => void) => Promise<void>;
  onOrder: () => void;
  onCollect: () => void;
  onEdit: () => void;
  onRepeat: (lines: OrderLineInput[]) => void;
  onOpenOrder: (id: string) => void;
}) {
  const [account, setAccount] = useState<ShopAccount | null>(null);
  const [fresh, setFresh] = useState(false);
  const [tab, setTab] = useState<"orders" | "ledger">("orders");

  // Saved copy first (offline), then fresh from the server. Re-run after a sync changes the shop.
  useEffect(() => {
    let alive = true;
    loadAccount(r.id, (a, isFresh) => {
      if (!alive) return;
      setAccount(a);
      setFresh(isFresh);
    });
    return () => {
      alive = false;
    };
  }, [r.id, r.local, r.outstanding, loadAccount]);

  const shownPhoto = photo !== undefined ? photo : account?.photo ?? null;
  const myShopOrders = orders.filter((o) => o.retailerId === r.id);
  // Last order for one-tap repeat: newest from shop history (any salesman) or my orders
  const lastLines = account?.orders.find((o) => o.status !== "cancelled")?.lines ?? myShopOrders.find((o) => o.status !== "cancelled")?.lines;
  const productIds = useMemo(() => new Set(catalog.products.map((p) => p.id)), [catalog.products]);
  const repeatable = (lastLines ?? []).filter((l) => productIds.has(l.productId));
  const outstanding = account && fresh ? account.outstanding : r.outstanding;
  const overdue = account && fresh ? account.overdue : r.overdue;

  return (
    <div className="space-y-3 p-3">
      <Card>
        {shownPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shownPhoto} alt={`${r.name} shop front`} className="h-44 w-full object-cover" />
        )}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-lg font-semibold">{r.name}</span>
                {r.status === "pending" && <Chip tone="amber">Awaiting approval</Chip>}
                {r.local && <Chip tone="gray">Not uploaded</Chip>}
              </div>
              <div className="text-sm text-gray-500">{r.ownerName}</div>
            </div>
            <button onClick={onEdit} className="flex h-9 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-sm text-gray-700 active:bg-gray-50">
              <Pencil size={14} /> Edit
            </button>
          </div>
          {(r.address || r.area) && (
            <div className="mt-2 flex items-start gap-1.5 text-sm text-gray-700">
              <MapPin size={15} className="mt-0.5 shrink-0 text-gray-400" />
              <span>
                {[r.address, r.area].filter(Boolean).join(", ")}
                {r.lat != null && r.lng != null && (
                  <a href={mapsUrl(r.lat, r.lng)} target="_blank" rel="noreferrer" className="ml-1.5 font-medium text-brand-700">
                    Map
                  </a>
                )}
              </span>
            </div>
          )}
          {r.phone && (
            <a href={`tel:${r.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
              <Phone size={15} /> {r.phone}
            </a>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
            <div>
              <div className="text-[11px] uppercase text-gray-500">Due</div>
              <div className="font-semibold tabular-nums">{money(outstanding)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-gray-500">Overdue</div>
              <div className={cn("font-semibold tabular-nums", overdue > 0 && "text-red-700")}>{money(overdue)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase text-gray-500">Limit</div>
              <div className="font-semibold tabular-nums">{r.creditLimit == null ? "—" : r.status === "pending" ? "—" : money(r.creditLimit)}</div>
            </div>
          </div>
        </div>
      </Card>

      <CreditWarnings r={r} />

      <button
        onClick={onOrder}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-lg font-semibold text-white active:bg-brand-700"
      >
        <ShoppingCart size={22} /> {cartCount ? `Continue order (${cartCount} items)` : "New order"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <BigButton variant="secondary" onClick={onCollect}>
          <IndianRupee size={18} /> Collect
        </BigButton>
        <BigButton variant="secondary" onClick={() => onRepeat(repeatable)} disabled={!repeatable.length}>
          <Repeat size={18} /> Repeat last
        </BigButton>
      </div>

      <Card>
        <div className="flex border-b border-gray-100 text-sm font-medium">
          {(
            [
              ["orders", "Orders"],
              ["ledger", "Bills & payments"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn("flex-1 py-2.5", tab === k ? "border-b-2 border-brand-600 text-brand-700" : "text-gray-500")}
            >
              {l}
            </button>
          ))}
        </div>
        {tab === "orders" ? (
          <ul className="divide-y divide-gray-100 text-sm">
            {pendingCount > 0 && <li className="px-4 py-2 text-amber-800">{pendingCount} change(s) waiting to upload</li>}
            {mergeShopOrders(myShopOrders, account).map((o) => (
              <li key={o.id}>
                <button onClick={() => o.mine && onOpenOrder(o.id)} className="flex w-full items-center justify-between px-4 py-2.5 text-left active:bg-gray-50">
                  <span>
                    {o.orderNo ? `#${o.orderNo}` : "New"} <span className="text-gray-500">· {dateTime(o.bookedAt)}</span>
                    {!o.mine && <span className="block text-xs text-gray-400">by {o.bookedBy}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{money(o.deliveredTotal ?? o.total)}</span>
                    {o.unsynced ? <Chip tone="amber">Not uploaded</Chip> : <StatusChip status={o.status} />}
                  </span>
                </button>
              </li>
            ))}
            {myShopOrders.length === 0 && !account?.orders.length && <li className="p-4 text-center text-gray-500">No orders yet.</li>}
          </ul>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {!account && <li className="p-4 text-center text-gray-500">Connect to the internet once to load this shop&apos;s account.</li>}
            {account?.entries.map((e, i) => (
              <li key={i} className="flex items-center justify-between px-4 py-2.5">
                <span>
                  {e.label}
                  <span className="block text-xs text-gray-500">{dateTime(e.at)}</span>
                </span>
                <span className={cn("tabular-nums font-medium", e.kind === "payment" ? "text-emerald-700" : "text-gray-900")}>
                  {e.kind === "payment" ? "−" : "+"}
                  {money(e.amount)}
                </span>
              </li>
            ))}
            {account && account.entries.length === 0 && <li className="p-4 text-center text-gray-500">No bills or payments yet.</li>}
          </ul>
        )}
        {account && (
          <div className="border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400">
            {fresh ? "Up to date" : `Saved copy from ${ago(account.fetchedAt)}`}
          </div>
        )}
      </Card>
    </div>
  );
}

function mergeShopOrders(mine: AppOrder[], account: ShopAccount | null) {
  const seen = new Set(mine.map((o) => o.id));
  const fromAccount = (account?.orders ?? [])
    .filter((o) => !seen.has(o.id))
    .map((o) => ({ ...o, mine: false, unsynced: false }));
  const own = mine.map((o) => ({ ...o, bookedBy: "me", mine: true }));
  return [...own, ...fromAccount].sort((a, b) => b.bookedAt.localeCompare(a.bookedAt)).slice(0, 15);
}

// ------------------------------------------------------------------ add / edit shop
export function ShopForm({
  shop,
  catalog,
  areas,
  photo,
  onSave,
}: {
  shop?: CatalogRetailer;
  catalog: Catalog;
  areas: string[];
  photo: string | null | undefined;
  onSave: (fields: ShopFields) => Promise<void>;
}) {
  const [f, setF] = useState<ShopFields>({
    name: shop?.name ?? "",
    ownerName: shop?.ownerName ?? "",
    phone: shop?.phone ?? "",
    address: shop?.address ?? "",
    area: shop?.area ?? "",
    // New shops default to the plain "Retail" type when there is one
    typeId: shop ? shop.typeId : (catalog.types.find((t) => /^retail/i.test(t.name)) ?? catalog.types[0])?.id ?? null,
    lat: shop?.lat ?? null,
    lng: shop?.lng ?? null,
  });
  const [newPhoto, setNewPhoto] = useState<string | null | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const typeLocked = shop && shop.status !== "pending";
  const shownPhoto = newPhoto !== undefined ? newPhoto : photo;
  const set = (patch: Partial<ShopFields>) => setF((x) => ({ ...x, ...patch }));

  async function locate() {
    setLocating(true);
    const p = await getPosition(10000);
    setLocating(false);
    if (p) {
      set({ lat: p.lat, lng: p.lng });
      setAccuracy(p.accuracy);
    } else setError("Could not get location. Turn on GPS and allow location for this app.");
  }

  const field = "h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-base outline-none focus:border-brand-500";
  return (
    <div className="space-y-3 p-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Shop name *</span>
        <input value={f.name} onChange={(e) => set({ name: e.target.value })} className={field} placeholder="e.g. Sharma General Store" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Owner</span>
          <input value={f.ownerName ?? ""} onChange={(e) => set({ ownerName: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Phone</span>
          <input value={f.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} type="tel" inputMode="tel" className={field} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Area</span>
        <input value={f.area ?? ""} onChange={(e) => set({ area: e.target.value })} list="shop-areas" className={field} />
        <datalist id="shop-areas">
          {areas.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Address</span>
        <input value={f.address ?? ""} onChange={(e) => set({ address: e.target.value })} className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Shop type</span>
        <select value={f.typeId ?? ""} disabled={typeLocked} onChange={(e) => set({ typeId: e.target.value || null })} className={cn(field, typeLocked && "bg-gray-100")}>
          {catalog.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {typeLocked && <span className="mt-1 block text-xs text-gray-500">Only the office can change the type (it changes prices).</span>}
      </label>

      <Card className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm">
            <div className="font-medium">Location</div>
            <div className="text-xs text-gray-500">
              {f.lat != null && f.lng != null ? (
                <>
                  {f.lat.toFixed(5)}, {f.lng.toFixed(5)}
                  {accuracy != null && ` · ±${accuracy} m`}
                </>
              ) : (
                "Stand at the shop and capture"
              )}
            </div>
          </div>
          <button onClick={locate} disabled={locating} className="flex h-10 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium active:bg-gray-50">
            <Crosshair size={16} /> {locating ? "Locating…" : f.lat != null ? "Update" : "Capture"}
          </button>
        </div>
      </Card>

      <Card className="p-3">
        <div className="mb-2 text-sm font-medium">Shop photo</div>
        {shownPhoto ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownPhoto} alt="Shop front" className="h-44 w-full rounded-lg object-cover" />
            <button
              onClick={() => setNewPhoto(null)}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-600"
              aria-label="Remove photo"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-600 active:bg-gray-50">
            <Camera size={24} />
            Take or choose photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setNewPhoto(await photoToDataUrl(file));
                } catch {
                  setError("Could not read that photo.");
                }
              }}
            />
          </label>
        )}
      </Card>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <BigButton
        variant="success"
        disabled={saving}
        onClick={async () => {
          if (!f.name.trim()) {
            setError("Shop name is required.");
            return;
          }
          if (f.phone && f.phone.replace(/\D/g, "").length < 10) {
            setError("Phone number looks too short.");
            return;
          }
          setSaving(true);
          try {
            await onSave({ ...f, name: f.name.trim(), ...(newPhoto !== undefined ? { photo: newPhoto } : {}) });
          } finally {
            setSaving(false);
          }
        }}
      >
        {saving ? "Saving…" : shop ? "Save changes" : "Add shop"}
      </BigButton>
      {!shop && <p className="text-center text-xs text-gray-500">The office will approve the new shop. You can book orders for it right away.</p>}
    </div>
  );
}
