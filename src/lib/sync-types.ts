/** Shapes exchanged between the salesman's phone and the server (shared by both sides). */

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  caseSize: number;
  mrp: number;
  basePrice: number;
};

export type CatalogRetailer = {
  id: string;
  name: string;
  ownerName: string | null;
  phone: string | null;
  area: string | null;
  address: string | null;
  typeId: string | null;
  creditLimit: number | null;
  creditDays: number;
  outstanding: number;
  overdue: number;
  openOrders: number;
  status: "active" | "pending";
  lat: number | null;
  lng: number | null;
  hasPhoto: boolean;
  /** Only on the phone: created/edited here and not uploaded yet */
  local?: boolean;
};

export type OrderLineInput = { productId: string; qty: number; price: number };

export type MyOrder = {
  id: string;
  orderNo: number;
  retailerId: string;
  retailerName: string;
  status: string;
  total: number;
  deliveredTotal: number | null;
  bookedAt: string;
  items: number;
  notes: string | null;
  lines: OrderLineInput[];
};

export type Catalog = {
  user: { id: string; name: string; role: string };
  serverTime: string;
  products: CatalogProduct[];
  retailers: CatalogRetailer[];
  types: { id: string; name: string }[];
  typePrices: { productId: string; typeId: string; price: number }[];
  retailerPrices: { productId: string; retailerId: string; price: number }[];
  myOrders: MyOrder[];
};

type Base = { id: string; userId: string; retailerId: string; retailerName: string; error?: string };

/** New order. `id` is also the order id. */
export type OutboxOrder = Base & {
  kind: "order";
  bookedAt: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  lines: OrderLineInput[];
  total: number;
};

export type OutboxPayment = Base & {
  kind: "payment";
  amount: number;
  mode: "cash" | "upi" | "cheque" | "bank";
  reference: string | null;
  notes: string | null;
  collectedAt: string;
};

export type ShopFields = {
  name: string;
  ownerName: string | null;
  phone: string | null;
  address: string | null;
  area: string | null;
  typeId: string | null;
  lat: number | null;
  lng: number | null;
  /** JPEG data URL; null = remove; undefined = unchanged */
  photo?: string | null;
};

/** Add a new shop (mode "create", retailerId is new) or edit an existing one. */
export type OutboxRetailer = Base & { kind: "retailer"; mode: "create" | "update"; fields: ShopFields; at: string };

/** Change items/notes of an order that is still waiting for approval. */
export type OutboxOrderEdit = Base & {
  kind: "orderEdit";
  orderId: string;
  orderNo: number;
  lines: OrderLineInput[];
  notes: string | null;
  total: number;
};

export type OutboxOrderCancel = Base & { kind: "orderCancel"; orderId: string; orderNo: number; reason: string };

export type OutboxItem = OutboxOrder | OutboxPayment | OutboxRetailer | OutboxOrderEdit | OutboxOrderCancel;

export type SyncRequest = { items: OutboxItem[] };
export type SyncResult = { id: string; ok: boolean; error?: string; orderNo?: number };
export type SyncResponse = { results: SyncResult[] };

/** A shop's account as shown in the app (fetched online, cached on the phone). */
export type ShopAccount = {
  retailerId: string;
  photo: string | null;
  outstanding: number;
  overdue: number;
  openOrders: number;
  entries: { at: string; kind: "opening" | "bill" | "payment"; amount: number; label: string }[];
  orders: {
    id: string;
    orderNo: number;
    status: string;
    total: number;
    deliveredTotal: number | null;
    bookedAt: string;
    bookedBy: string;
    lines: OrderLineInput[];
  }[];
  fetchedAt: string;
};
