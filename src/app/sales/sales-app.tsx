"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/components/ui";
import { buildPriceTables, resolvePrice } from "@/lib/pricing";
import type { OrderLineInput, OutboxOrder, OutboxRetailer, ShopFields } from "@/lib/sync-types";
import { logout } from "@/app/login/actions";
import { useSalesStore } from "./use-sales-store";
import { kvGet, kvSet } from "./local-db";
import { canChange, localPhoto, mergeOrders, mergeRetailers, type AppOrder } from "./derive";
import { BottomNav, TopBar, getPosition, type Tab } from "./ui";
import { ShopForm, ShopView, ShopsView } from "./views/shops";
import { DoneView, OrderDetail, OrderPad, OrdersView, ReviewView, type Cart } from "./views/orders";
import { AccountView, CollectView, ProductsView } from "./views/misc";

/** `key` is the cart: a retailer id for a new order, or `edit:<orderId>` when changing an order. */
type View =
  | { t: "shops" }
  | { t: "shop"; id: string }
  | { t: "shopForm"; id?: string }
  | { t: "order"; id: string; key: string; editOrderId?: string }
  | { t: "review"; id: string; key: string; editOrderId?: string }
  | { t: "done"; id: string; title: string }
  | { t: "collect"; id: string }
  | { t: "orders" }
  | { t: "orderDetail"; id: string }
  | { t: "products" }
  | { t: "account" };

const TAB_OF: Record<string, Tab> = { orders: "orders", orderDetail: "orders", products: "products", account: "account" };
const emptyCart: Cart = { items: {}, notes: "" };

export function SalesApp() {
  const store = useSalesStore();
  const { catalog, outbox, sync } = store;
  const [stack, setStack] = useState<View[]>([{ t: "shops" }]);
  const view = stack[stack.length - 1];
  const [carts, setCarts] = useState<Record<string, Cart>>({});
  const userId = catalog?.user.id;

  // Persist carts per user so an unfinished order survives closing the app
  useEffect(() => {
    if (!userId) return;
    kvGet<Record<string, Cart>>(`carts2:${userId}`).then((c) => c && setCarts(c));
  }, [userId]);
  const updateCarts = useCallback(
    (fn: (c: Record<string, Cart>) => Record<string, Cart>) => {
      setCarts((prev) => {
        const next = fn(prev);
        if (userId) kvSet(`carts2:${userId}`, next);
        return next;
      });
    },
    [userId],
  );
  const setQty = (key: string, pid: string, q: number) =>
    updateCarts((c) => {
      const cart = c[key] ?? emptyCart;
      const items = { ...cart.items };
      if (q > 0) items[pid] = q;
      else delete items[pid];
      return { ...c, [key]: { ...cart, items } };
    });
  const setNotes = (key: string, notes: string) => updateCarts((c) => ({ ...c, [key]: { ...(c[key] ?? emptyCart), notes } }));
  const clearCart = (key: string) =>
    updateCarts((c) => {
      const next = { ...c };
      delete next[key];
      return next;
    });

  // In-app navigation; the phone's back button goes back inside the app
  const go = useCallback((v: View, replace = false) => {
    setStack((s) => (replace ? [...s.slice(0, -1), v] : [...s, v]));
    if (!replace) history.pushState({ app: true }, "");
    window.scrollTo(0, 0);
  }, []);
  const tab = useCallback((t: Tab) => {
    setStack([{ t } as View]);
    window.scrollTo(0, 0);
  }, []);
  const back = useCallback(() => history.back(), []);
  useEffect(() => {
    const onPop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const mine = useMemo(() => outbox.filter((o) => !userId || o.userId === userId), [outbox, userId]);
  const retailers = useMemo(() => (catalog ? mergeRetailers(catalog, mine) : []), [catalog, mine]);
  const orders = useMemo(() => (catalog ? mergeOrders(catalog, mine) : []), [catalog, mine]);
  const prices = useMemo(() => (catalog ? buildPriceTables(catalog.typePrices, catalog.retailerPrices) : null), [catalog]);
  const retailerById = useMemo(() => new Map(retailers.map((r) => [r.id, r])), [retailers]);
  const productById = useMemo(() => new Map(catalog?.products.map((p) => [p.id, p]) ?? []), [catalog]);
  const areas = useMemo(() => [...new Set(retailers.map((r) => r.area).filter(Boolean) as string[])].sort(), [retailers]);

  if (!store.loaded) return <div className="flex min-h-screen items-center justify-center text-gray-500">Opening…</div>;

  if (!catalog || !prices) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        {sync.authError ? (
          <>
            <p className="text-gray-700">Please log in to continue.</p>
            <a href="/login?expired=1" className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white">
              Log in
            </a>
          </>
        ) : (
          <>
            <RefreshCw className={cn("text-brand-600", sync.syncing && "animate-spin")} size={32} />
            <p className="text-gray-700">
              {sync.syncing
                ? "Downloading products and shops…"
                : "Connect to the internet once to download products and shops. After that the app works offline."}
            </p>
            {!sync.syncing && (
              <button onClick={store.runSync} className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white">
                Try again
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const me = catalog.user;
  const retailer = "id" in view && view.t !== "orderDetail" && view.id ? retailerById.get(view.id) : undefined;
  const pendingFor = (rid: string) => mine.filter((o) => o.retailerId === rid).length;
  const order = view.t === "orderDetail" ? orders.find((o) => o.id === view.id) : undefined;

  // ---------------------------------------------------------------- actions
  const linesFromCart = (rid: string, cart: Cart): OrderLineInput[] => {
    const r = retailerById.get(rid)!;
    return Object.entries(cart.items)
      .filter(([pid]) => productById.has(pid))
      .map(([productId, qty]) => ({ productId, qty, price: resolvePrice(productById.get(productId)!, r, prices).price }));
  };

  async function placeOrder(v: Extract<View, { t: "review" }>) {
    const cart = carts[v.key] ?? emptyCart;
    const lines = linesFromCart(v.id, cart);
    if (!lines.length) return;
    const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
    const notes = cart.notes.trim() || null;
    const r = retailerById.get(v.id)!;

    if (v.editOrderId) {
      const o = orders.find((x) => x.id === v.editOrderId);
      if (o?.unsynced) {
        await store.updateOutboxItem(o.id, { lines, total, notes } as Partial<OutboxOrder>);
      } else if (o) {
        // Only the latest change matters: replace earlier unsent edits of this order
        await store.removeFromOutbox(mine.filter((i) => i.kind === "orderEdit" && i.orderId === o.id).map((i) => i.id));
        await store.addToOutbox({
          kind: "orderEdit",
          id: crypto.randomUUID(),
          userId: me.id,
          retailerId: r.id,
          retailerName: r.name,
          orderId: o.id,
          orderNo: o.orderNo ?? 0,
          lines,
          notes,
          total,
        });
      }
      clearCart(v.key);
      go({ t: "done", id: r.id, title: "Order updated" }, true);
      return;
    }

    const pos = await getPosition(5000);
    await store.addToOutbox({
      kind: "order",
      id: crypto.randomUUID(),
      userId: me.id,
      retailerId: r.id,
      retailerName: r.name,
      bookedAt: new Date().toISOString(),
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      notes,
      lines,
      total,
    });
    clearCart(v.key);
    go({ t: "done", id: r.id, title: "Order saved" }, true);
  }

  function startEdit(o: AppOrder) {
    const key = `edit:${o.id}`;
    updateCarts((c) => ({ ...c, [key]: { items: Object.fromEntries(o.lines.map((l) => [l.productId, l.qty])), notes: o.notes ?? "" } }));
    go({ t: "order", id: o.retailerId, key, editOrderId: o.id });
  }

  async function cancelOrder(o: AppOrder, reason: string) {
    if (o.unsynced) {
      await store.removeFromOutbox(o.id);
      back();
      return;
    }
    await store.removeFromOutbox(mine.filter((i) => i.kind === "orderEdit" && i.orderId === o.id).map((i) => i.id));
    await store.addToOutbox({
      kind: "orderCancel",
      id: crypto.randomUUID(),
      userId: me.id,
      retailerId: o.retailerId,
      retailerName: o.retailerName,
      orderId: o.id,
      orderNo: o.orderNo ?? 0,
      reason,
    });
  }

  function repeat(rid: string, lines: OrderLineInput[]) {
    const items = Object.fromEntries(lines.filter((l) => productById.has(l.productId)).map((l) => [l.productId, l.qty]));
    updateCarts((c) => ({ ...c, [rid]: { items, notes: "" } }));
    go({ t: "review", id: rid, key: rid });
  }

  async function saveShop(fields: ShopFields, existingId?: string) {
    const id = existingId ?? crypto.randomUUID();
    const op: OutboxRetailer = {
      kind: "retailer",
      id: crypto.randomUUID(),
      userId: me.id,
      retailerId: id,
      retailerName: fields.name,
      mode: existingId ? "update" : "create",
      fields,
      at: new Date().toISOString(),
    };
    await store.addToOutbox(op);
    if (existingId) back();
    else go({ t: "shop", id }, true);
  }

  // ---------------------------------------------------------------- title
  const title =
    view.t === "shops"
      ? "Shops"
      : view.t === "orders"
        ? "My orders"
        : view.t === "products"
          ? "Products & prices"
          : view.t === "account"
            ? "Account"
            : view.t === "shopForm"
              ? view.id
                ? "Edit shop"
                : "Add shop"
              : view.t === "orderDetail"
                ? (order?.retailerName ?? "Order")
                : (retailer?.name ?? "");

  const otherPending = mine
    .filter((i) => i.kind !== "order" && i.kind !== "orderEdit" && i.kind !== "orderCancel")
    .map((i) => ({
      id: i.id,
      label:
        i.kind === "payment"
          ? `Payment · ${i.retailerName}`
          : `${i.kind === "retailer" && i.mode === "create" ? "New shop" : "Shop changes"} · ${i.retailerName}`,
      amount: i.kind === "payment" ? i.amount : undefined,
      error: i.error,
    }));

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f5f6f8] pb-24">
      <TopBar title={title} sub={me.name} sync={sync} pending={mine.length} onSync={store.runSync} onBack={stack.length > 1 ? back : undefined} />

      {sync.authError && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Your login has expired. Your work is saved on this phone.{" "}
          <a href="/login?expired=1" className="font-semibold underline">
            Log in again
          </a>{" "}
          to upload it.
        </div>
      )}

      {view.t === "shops" && (
        <ShopsView
          retailers={retailers}
          cartCount={(rid) => Object.keys(carts[rid]?.items ?? {}).length}
          onOpen={(id) => go({ t: "shop", id })}
          onAdd={() => go({ t: "shopForm" })}
        />
      )}

      {view.t === "shopForm" && (
        <ShopForm
          key={view.id ?? "new"}
          shop={view.id ? retailerById.get(view.id) : undefined}
          catalog={catalog}
          areas={areas}
          photo={view.id ? localPhoto(mine, view.id) : undefined}
          onSave={(f) => saveShop(f, view.id)}
        />
      )}

      {view.t === "shop" && retailer && (
        <ShopView
          r={retailer}
          catalog={catalog}
          orders={orders}
          pendingCount={pendingFor(retailer.id)}
          cartCount={Object.keys(carts[retailer.id]?.items ?? {}).length}
          photo={localPhoto(mine, retailer.id)}
          loadAccount={store.loadShopAccount}
          onOrder={() => go({ t: "order", id: retailer.id, key: retailer.id })}
          onCollect={() => go({ t: "collect", id: retailer.id })}
          onEdit={() => go({ t: "shopForm", id: retailer.id })}
          onRepeat={(lines) => repeat(retailer.id, lines)}
          onOpenOrder={(id) => go({ t: "orderDetail", id })}
        />
      )}

      {view.t === "order" && retailer && (
        <OrderPad
          r={retailer}
          catalog={catalog}
          prices={prices}
          cart={carts[view.key] ?? emptyCart}
          editingNo={view.editOrderId ? (orders.find((o) => o.id === view.editOrderId)?.orderNo ?? null) : undefined}
          setQty={(pid, q) => setQty(view.key, pid, q)}
          onReview={() => go({ t: "review", id: view.id, key: view.key, editOrderId: view.editOrderId })}
        />
      )}

      {view.t === "review" && retailer && (
        <ReviewView
          r={retailer}
          productById={productById}
          prices={prices}
          cart={carts[view.key] ?? emptyCart}
          editing={!!view.editOrderId}
          pendingTotal={mine
            .filter((o): o is typeof o & OutboxOrder => o.kind === "order" && o.retailerId === retailer.id && o.id !== view.editOrderId)
            .reduce((s, o) => s + o.total, 0)}
          setQty={(pid, q) => setQty(view.key, pid, q)}
          setNotes={(n) => setNotes(view.key, n)}
          onAddMore={() => go({ t: "order", id: view.id, key: view.key, editOrderId: view.editOrderId })}
          onPlace={() => placeOrder(view)}
        />
      )}

      {view.t === "collect" && retailer && (
        <CollectView
          r={retailer}
          onSave={async (p) => {
            await store.addToOutbox({
              kind: "payment",
              id: crypto.randomUUID(),
              userId: me.id,
              retailerId: retailer.id,
              retailerName: retailer.name,
              collectedAt: new Date().toISOString(),
              ...p,
            });
            go({ t: "done", id: retailer.id, title: "Payment saved" }, true);
          }}
        />
      )}

      {view.t === "done" && retailer && (
        <DoneView
          title={view.title}
          r={retailer}
          online={sync.online}
          waiting={pendingFor(retailer.id) > 0}
          onNext={() => tab("shops")}
          onShop={() => {
            // Start a clean path Shops → this shop (don't step back into the order screens)
            setStack([{ t: "shops" }, { t: "shop", id: retailer.id }]);
            window.scrollTo(0, 0);
          }}
        />
      )}

      {view.t === "orders" && (
        <OrdersView orders={orders} otherPending={otherPending} onOpen={(id) => go({ t: "orderDetail", id })} onDiscard={store.removeFromOutbox} />
      )}

      {view.t === "orderDetail" &&
        (order ? (
          <OrderDetail
            o={order}
            productById={productById}
            onEdit={() => canChange(order) && startEdit(order)}
            onCancel={(reason) => cancelOrder(order, reason)}
            onRepeat={() => repeat(order.retailerId, order.lines)}
            onDiscardError={() => {
              const ids = mine.filter((i) => i.id === order.id || ((i.kind === "orderEdit" || i.kind === "orderCancel") && i.orderId === order.id)).map((i) => i.id);
              store.removeFromOutbox(ids);
            }}
          />
        ) : (
          <div className="p-6 text-center text-gray-500">This order is no longer on the phone.</div>
        ))}

      {view.t === "products" && <ProductsView catalog={catalog} />}

      {view.t === "account" && (
        <AccountView
          catalog={catalog}
          sync={sync}
          pending={mine.length}
          shops={retailers.length}
          onSync={store.runSync}
          onLogout={async () => {
            await store.clearLocal();
            await logout();
          }}
        />
      )}

      <BottomNav active={TAB_OF[view.t] ?? "shops"} pending={mine.length} onTab={tab} />
    </div>
  );
}
