/**
 * What the salesman sees = data from the last sync + changes still waiting on the phone.
 * These pure functions merge the two so offline work shows up immediately.
 */
import type {
  Catalog,
  CatalogRetailer,
  OrderLineInput,
  OutboxOrder,
  OutboxOrderCancel,
  OutboxOrderEdit,
  OutboxRetailer,
} from "@/lib/sync-types";
import type { OutboxRow } from "./local-db";

export function mergeRetailers(catalog: Catalog, outbox: OutboxRow[]): CatalogRetailer[] {
  const map = new Map(catalog.retailers.map((r) => [r.id, r]));
  for (const item of outbox) {
    if (item.kind !== "retailer") continue;
    const op = item as OutboxRetailer;
    const f = op.fields;
    const base: CatalogRetailer = map.get(op.retailerId) ?? {
      id: op.retailerId,
      name: f.name,
      ownerName: null,
      phone: null,
      area: null,
      address: null,
      typeId: null,
      creditLimit: 0,
      creditDays: 15,
      outstanding: 0,
      overdue: 0,
      openOrders: 0,
      status: "pending",
      lat: null,
      lng: null,
      hasPhoto: false,
    };
    map.set(op.retailerId, {
      ...base,
      name: f.name,
      ownerName: f.ownerName,
      phone: f.phone,
      area: f.area,
      address: f.address,
      typeId: base.status === "pending" ? f.typeId : base.typeId,
      lat: f.lat ?? base.lat,
      lng: f.lng ?? base.lng,
      hasPhoto: f.photo === undefined ? base.hasPhoto : Boolean(f.photo),
      local: true,
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Latest photo taken on the phone for a shop, if any (undefined = none taken here). */
export function localPhoto(outbox: OutboxRow[], retailerId: string): string | null | undefined {
  let photo: string | null | undefined;
  for (const item of outbox) {
    if (item.kind === "retailer" && item.retailerId === retailerId && item.fields.photo !== undefined) {
      photo = item.fields.photo;
    }
  }
  return photo;
}

export type AppOrder = {
  id: string;
  orderNo: number | null;
  retailerId: string;
  retailerName: string;
  status: string;
  total: number;
  deliveredTotal: number | null;
  bookedAt: string;
  notes: string | null;
  lines: OrderLineInput[];
  /** Saved on the phone only */
  unsynced?: boolean;
  /** Changes/cancel waiting to upload */
  pendingEdit?: boolean;
  pendingCancel?: boolean;
  error?: string;
};

export function mergeOrders(catalog: Catalog, outbox: OutboxRow[]): AppOrder[] {
  const local: AppOrder[] = outbox
    .filter((i): i is OutboxRow & OutboxOrder => i.kind === "order")
    .map((o) => ({
      id: o.id,
      orderNo: null,
      retailerId: o.retailerId,
      retailerName: o.retailerName,
      status: "booked",
      total: o.total,
      deliveredTotal: null,
      bookedAt: o.bookedAt,
      notes: o.notes,
      lines: o.lines,
      unsynced: true,
      error: o.error,
    }))
    .reverse();

  const edits = new Map<string, OutboxOrderEdit & { error?: string }>();
  const cancels = new Map<string, OutboxOrderCancel & { error?: string }>();
  for (const i of outbox) {
    if (i.kind === "orderEdit") edits.set(i.orderId, i);
    if (i.kind === "orderCancel") cancels.set(i.orderId, i);
  }

  const server: AppOrder[] = catalog.myOrders.map((o) => {
    const e = edits.get(o.id);
    const c = cancels.get(o.id);
    return {
      ...o,
      ...(e ? { lines: e.lines, notes: e.notes, total: e.total, pendingEdit: true } : {}),
      ...(c ? { pendingCancel: true } : {}),
      error: c?.error ?? e?.error,
    };
  });
  return [...local, ...server];
}

/** Orders can be changed by the salesman until the office approves them. */
export function canChange(o: AppOrder) {
  return !o.pendingCancel && (o.unsynced || o.status === "booked");
}
