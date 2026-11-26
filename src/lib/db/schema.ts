/**
 * Database schema.
 *
 * Conventions
 * - Money is stored as integer PAISE (₹1 = 100). Never floats.
 * - Quantities are stored as integer PIECES. A product's `caseSize` converts cases ↔ pieces.
 * - Stock lives on `batches` (per product + warehouse + batch number).
 *   "Reserved" stock is not stored; it is derived from approved/packed orders so it can never drift.
 */
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  date,
  serial,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ---------- Users ----------
export const roleEnum = pgEnum("role", ["admin", "salesman", "warehouse", "delivery"]);
export type Role = (typeof roleEnum.enumValues)[number];

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  phone: text().notNull().unique(),
  pinHash: text().notNull(),
  role: roleEnum().notNull(),
  active: boolean().notNull().default(true),
  failedAttempts: integer().notNull().default(0),
  lockedUntil: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
});

// ---------- Masters ----------
export const warehouses = pgTable("warehouses", {
  id: id(),
  name: text().notNull().unique(),
  address: text(),
  active: boolean().notNull().default(true),
  createdAt: createdAt(),
});

export const retailerTypes = pgTable("retailer_types", {
  id: id(),
  name: text().notNull().unique(),
});

export const retailerStatusEnum = pgEnum("retailer_status", ["active", "pending", "inactive"]);

export const retailers = pgTable(
  "retailers",
  {
    id: id(),
    name: text().notNull(),
    ownerName: text(),
    phone: text(),
    address: text(),
    area: text(),
    gstin: text(),
    typeId: text().references(() => retailerTypes.id),
    defaultWarehouseId: text().references(() => warehouses.id),
    /** null = no credit limit check */
    creditLimit: integer(),
    creditDays: integer().notNull().default(15),
    /** Balance carried over from before the app (paise, positive = retailer owes us) */
    openingBalance: integer().notNull().default(0),
    lat: doublePrecision(),
    lng: doublePrecision(),
    status: retailerStatusEnum().notNull().default("active"),
    /** Shop-front photo as a small JPEG data URL (taken in the app) */
    photo: text(),
    createdBy: text().references(() => users.id),
    createdAt: createdAt(),
    updatedBy: text().references(() => users.id),
    updatedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.name), index().on(t.area)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    sku: text().notNull().unique(),
    name: text().notNull(),
    brand: text(),
    category: text(),
    /** Name of the smallest unit, e.g. "pc", "pkt", "btl" */
    unit: text().notNull().default("pc"),
    /** Pieces per case. 1 = sold only as pieces */
    caseSize: integer().notNull().default(1),
    mrp: integer().notNull().default(0),
    /** Base selling price per piece (paise) */
    basePrice: integer().notNull(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.name)],
);

/** Price per piece for a retailer type. Overrides product.basePrice. */
export const typePrices = pgTable(
  "type_prices",
  {
    id: id(),
    productId: text()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    typeId: text()
      .notNull()
      .references(() => retailerTypes.id, { onDelete: "cascade" }),
    price: integer().notNull(),
  },
  (t) => [uniqueIndex().on(t.productId, t.typeId)],
);

/** Special negotiated price for one retailer. Overrides type price and base price. */
export const retailerPrices = pgTable(
  "retailer_prices",
  {
    id: id(),
    productId: text()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    retailerId: text()
      .notNull()
      .references(() => retailers.id, { onDelete: "cascade" }),
    price: integer().notNull(),
  },
  (t) => [uniqueIndex().on(t.productId, t.retailerId)],
);

// ---------- Stock ----------
export const suppliers = pgTable("suppliers", {
  id: id(),
  name: text().notNull().unique(),
  phone: text(),
  gstin: text(),
  createdAt: createdAt(),
});

export const batches = pgTable(
  "batches",
  {
    id: id(),
    productId: text()
      .notNull()
      .references(() => products.id),
    warehouseId: text()
      .notNull()
      .references(() => warehouses.id),
    batchNo: text().notNull(),
    expiry: date({ mode: "string" }),
    /** Pieces physically on hand */
    qty: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.productId, t.warehouseId, t.batchNo), index().on(t.expiry)],
);

export const purchases = pgTable("purchases", {
  id: id(),
  purchaseNo: serial().notNull().unique(),
  supplierId: text()
    .notNull()
    .references(() => suppliers.id),
  warehouseId: text()
    .notNull()
    .references(() => warehouses.id),
  invoiceNo: text(),
  invoiceDate: date({ mode: "string" }),
  total: integer().notNull().default(0),
  notes: text(),
  createdBy: text().references(() => users.id),
  createdAt: createdAt(),
});

export const purchaseLines = pgTable("purchase_lines", {
  id: id(),
  purchaseId: text()
    .notNull()
    .references(() => purchases.id, { onDelete: "cascade" }),
  productId: text()
    .notNull()
    .references(() => products.id),
  batchId: text()
    .notNull()
    .references(() => batches.id),
  qty: integer().notNull(),
  /** Cost per piece (paise) */
  rate: integer().notNull(),
});

export const movementKindEnum = pgEnum("movement_kind", [
  "purchase",
  "dispatch",
  "undelivered",
  "adjustment",
]);

/** Every change to batch qty is logged here (signed qty). */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    productId: text()
      .notNull()
      .references(() => products.id),
    warehouseId: text()
      .notNull()
      .references(() => warehouses.id),
    batchId: text()
      .notNull()
      .references(() => batches.id),
    qty: integer().notNull(),
    kind: movementKindEnum().notNull(),
    refId: text(),
    note: text(),
    createdBy: text().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.productId), index().on(t.createdAt)],
);

// ---------- Orders ----------
export const orderStatusEnum = pgEnum("order_status", [
  "booked",
  "approved",
  "packed",
  "dispatched",
  "delivered",
  "partially_delivered",
  "cancelled",
]);
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];

export const orders = pgTable(
  "orders",
  {
    /** Generated on the salesman's phone, so offline retries are idempotent */
    id: text().primaryKey(),
    orderNo: serial().notNull().unique(),
    retailerId: text()
      .notNull()
      .references(() => retailers.id),
    salesmanId: text()
      .notNull()
      .references(() => users.id),
    warehouseId: text().references(() => warehouses.id),
    status: orderStatusEnum().notNull().default("booked"),
    /** Over credit limit or has overdue dues when booked */
    creditFlag: boolean().notNull().default(false),
    /** Price on phone differed from server price when synced */
    priceFlag: boolean().notNull().default(false),
    flagNote: text(),
    notes: text(),
    lat: doublePrecision(),
    lng: doublePrecision(),
    /** Order value (paise): as booked, then replaced by the approved value on approval */
    total: integer().notNull().default(0),
    /** Total of delivered quantities (paise). This is what the retailer owes. */
    deliveredTotal: integer(),
    bookedAt: timestamp({ withTimezone: true }).notNull(),
    syncedAt: createdAt(),
    /** Last time the salesman/admin changed items before approval */
    editedAt: timestamp({ withTimezone: true }),
    approvedBy: text().references(() => users.id),
    approvedAt: timestamp({ withTimezone: true }),
    packedBy: text().references(() => users.id),
    packedAt: timestamp({ withTimezone: true }),
    dispatchedBy: text().references(() => users.id),
    dispatchedAt: timestamp({ withTimezone: true }),
    deliveryPersonId: text().references(() => users.id),
    deliveredAt: timestamp({ withTimezone: true }),
    cancelledBy: text().references(() => users.id),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
  },
  (t) => [
    index().on(t.status),
    index().on(t.retailerId),
    index().on(t.salesmanId),
    index().on(t.deliveryPersonId),
  ],
);

export const orderLines = pgTable(
  "order_lines",
  {
    id: id(),
    orderId: text()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text()
      .notNull()
      .references(() => products.id),
    /** Pieces ordered by the salesman */
    qty: integer().notNull(),
    /** Pieces approved by admin (reserved from stock) */
    approvedQty: integer(),
    /** Pieces actually delivered */
    deliveredQty: integer(),
    /** Price per piece (paise) */
    price: integer().notNull(),
    priceSource: text().notNull().default("base"),
  },
  (t) => [index().on(t.orderId), index().on(t.productId)],
);

/** Which batches were picked for an order line (set at packing, earliest expiry first). */
export const allocations = pgTable(
  "allocations",
  {
    id: id(),
    orderLineId: text()
      .notNull()
      .references(() => orderLines.id, { onDelete: "cascade" }),
    batchId: text()
      .notNull()
      .references(() => batches.id),
    qty: integer().notNull(),
  },
  (t) => [index().on(t.orderLineId), index().on(t.batchId)],
);

// ---------- Payments ----------
export const paymentModeEnum = pgEnum("payment_mode", ["cash", "upi", "bank", "cheque"]);
export type PaymentMode = (typeof paymentModeEnum.enumValues)[number];
export const paymentStatusEnum = pgEnum("payment_status", ["with_staff", "received"]);

export const payments = pgTable(
  "payments",
  {
    /** May be generated on the phone (offline collection) */
    id: text().primaryKey(),
    retailerId: text()
      .notNull()
      .references(() => retailers.id),
    amount: integer().notNull(),
    mode: paymentModeEnum().notNull(),
    reference: text(),
    notes: text(),
    orderId: text().references(() => orders.id),
    collectedBy: text()
      .notNull()
      .references(() => users.id),
    collectedAt: timestamp({ withTimezone: true }).notNull(),
    /** Cash/cheque collected by field staff stays "with_staff" until admin confirms handover */
    status: paymentStatusEnum().notNull(),
    receivedBy: text().references(() => users.id),
    receivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.retailerId), index().on(t.status)],
);
