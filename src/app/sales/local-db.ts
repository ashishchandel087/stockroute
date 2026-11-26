"use client";

import Dexie, { type Table } from "dexie";
import type { OutboxItem } from "@/lib/sync-types";

export type OutboxRow = OutboxItem & { createdAt: number };

/** On-device storage for the sales app (IndexedDB). Survives closing the app and going offline. */
class LocalDB extends Dexie {
  kv!: Table<{ key: string; value: unknown }, string>;
  outbox!: Table<OutboxRow, string>;
  constructor() {
    super("stockroute-sales");
    this.version(1).stores({ kv: "key", outbox: "id, kind, userId, createdAt" });
  }
}

let instance: LocalDB | null = null;
export function localDb(): LocalDB {
  if (!instance) instance = new LocalDB();
  return instance;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await localDb().kv.get(key))?.value as T | undefined;
}
export async function kvSet(key: string, value: unknown) {
  await localDb().kv.put({ key, value });
}
