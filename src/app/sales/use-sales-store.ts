"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Catalog, OutboxItem, ShopAccount, SyncResponse } from "@/lib/sync-types";
import { kvGet, kvSet, localDb, type OutboxRow } from "./local-db";

export type SyncState = {
  online: boolean;
  syncing: boolean;
  lastSync: string | null;
  /** Session expired / logged out: user must log in again (outbox is kept). */
  authError: boolean;
  error: string | null;
};

const TIMEOUT_MS = 20_000;

async function fetchWithTimeout(input: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal, cache: "no-store", credentials: "same-origin" });
  } finally {
    clearTimeout(t);
  }
}

const isNetworkError = (e: unknown) => e instanceof TypeError || (e as Error)?.name === "AbortError";

/**
 * Offline-first data for the salesman:
 * - Catalog (products, prices, shops, dues, my orders) cached on the phone.
 * - Outbox of shops/orders/edits/cancels/payments saved locally and uploaded in the
 *   order they were made. Safe to retry: every item has an id made on the phone.
 */
export function useSalesStore() {
  const [loaded, setLoaded] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [sync, setSync] = useState<SyncState>({
    online: true,
    syncing: false,
    lastSync: null,
    authError: false,
    error: null,
  });
  const syncing = useRef(false);
  const catalogRef = useRef<Catalog | null>(null);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  const reloadOutbox = useCallback(async () => {
    setOutbox(await localDb().outbox.orderBy("createdAt").toArray());
  }, []);

  const runSync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    setSync((s) => ({ ...s, syncing: true, error: null }));
    try {
      // 1. Upload my pending items, oldest first
      const me = catalogRef.current?.user.id;
      if (me) {
        const pending = (await localDb().outbox.orderBy("createdAt").toArray()).filter((i) => i.userId === me);
        if (pending.length) {
          const res = await fetchWithTimeout("/api/sales/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            body: JSON.stringify({ items: pending.map(({ createdAt, error, ...item }) => item) }),
          });
          if (res.status === 401) {
            setSync((s) => ({ ...s, authError: true, online: true }));
            return;
          }
          if (!res.ok) throw new Error(`Upload failed (${res.status})`);
          const data = (await res.json()) as SyncResponse;
          for (const r of data.results) {
            if (r.ok) await localDb().outbox.delete(r.id);
            else await localDb().outbox.update(r.id, { error: r.error ?? "Rejected" });
          }
          await reloadOutbox();
        }
      }

      // 2. Download fresh catalog
      const res = await fetchWithTimeout("/api/sales/bootstrap");
      if (res.status === 401) {
        setSync((s) => ({ ...s, authError: true, online: true }));
        return;
      }
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const fresh = (await res.json()) as Catalog;
      await kvSet("catalog", fresh);
      const now = new Date().toISOString();
      await kvSet("lastSync", now);
      catalogRef.current = fresh;
      setCatalog(fresh);
      setSync((s) => ({ ...s, online: true, authError: false, lastSync: now }));
    } catch (e) {
      const offline = isNetworkError(e) || !navigator.onLine;
      setSync((s) => ({ ...s, online: !offline, error: offline ? null : (e as Error).message }));
    } finally {
      syncing.current = false;
      setSync((s) => ({ ...s, syncing: false }));
    }
  }, [reloadOutbox]);

  // Load from device, then sync
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, last] = await Promise.all([kvGet<Catalog>("catalog"), kvGet<string>("lastSync")]);
      if (cancelled) return;
      catalogRef.current = c ?? null;
      setCatalog(c ?? null);
      setSync((s) => ({ ...s, lastSync: last ?? null, online: navigator.onLine }));
      await reloadOutbox();
      setLoaded(true);
      runSync();
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadOutbox, runSync]);

  // Re-sync when the network comes back, when the app is reopened, and periodically
  useEffect(() => {
    const onOnline = () => {
      setSync((s) => ({ ...s, online: true }));
      runSync();
    };
    const onOffline = () => setSync((s) => ({ ...s, online: false }));
    const onVisible = () => document.visibilityState === "visible" && runSync();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(async () => {
      if (!navigator.onLine) return;
      const pending = await localDb().outbox.count();
      if (pending > 0) runSync();
    }, 45_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [runSync]);

  /** Save something to upload. */
  const addToOutbox = useCallback(
    async (item: OutboxItem) => {
      await localDb().outbox.put({ ...item, createdAt: Date.now() });
      await reloadOutbox();
      runSync();
    },
    [reloadOutbox, runSync],
  );

  /** Change an item that hasn't been uploaded yet (e.g. edit an offline order). */
  const updateOutboxItem = useCallback(
    async (id: string, patch: Partial<OutboxItem>) => {
      await localDb().outbox.update(id, { ...patch, error: undefined } as Partial<OutboxRow>);
      await reloadOutbox();
      runSync();
    },
    [reloadOutbox, runSync],
  );

  const removeFromOutbox = useCallback(
    async (ids: string | string[]) => {
      await localDb().outbox.bulkDelete(Array.isArray(ids) ? ids : [ids]);
      await reloadOutbox();
    },
    [reloadOutbox],
  );

  /** Shop account: saved copy first (works offline), then fresh from the server when online. */
  const loadShopAccount = useCallback(
    async (retailerId: string, onData: (a: ShopAccount, fresh: boolean) => void) => {
      const cached = await kvGet<ShopAccount>(`shop:${retailerId}`);
      if (cached) onData(cached, false);
      try {
        const res = await fetchWithTimeout(`/api/sales/shops/${retailerId}`);
        if (!res.ok) return;
        const fresh = (await res.json()) as ShopAccount;
        await kvSet(`shop:${retailerId}`, fresh);
        onData(fresh, true);
      } catch {
        /* offline: cached copy stays */
      }
    },
    [],
  );

  const clearLocal = useCallback(async () => {
    await localDb().kv.clear();
    await localDb().outbox.clear();
  }, []);

  return {
    loaded,
    catalog,
    outbox,
    sync,
    runSync,
    addToOutbox,
    updateOutboxItem,
    removeFromOutbox,
    loadShopAccount,
    clearLocal,
  };
}
