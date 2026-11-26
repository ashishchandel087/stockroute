CREATE TYPE "public"."movement_kind" AS ENUM('purchase', 'dispatch', 'undelivered', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('booked', 'approved', 'packed', 'dispatched', 'delivered', 'partially_delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'upi', 'bank', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('with_staff', 'received');--> statement-breakpoint
CREATE TYPE "public"."retailer_status" AS ENUM('active', 'pending', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'salesman', 'warehouse', 'delivery');--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"order_line_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"qty" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"batch_no" text NOT NULL,
	"expiry" date,
	"qty" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"qty" integer NOT NULL,
	"approved_qty" integer,
	"delivered_qty" integer,
	"price" integer NOT NULL,
	"price_source" text DEFAULT 'base' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_no" serial NOT NULL,
	"retailer_id" text NOT NULL,
	"salesman_id" text NOT NULL,
	"warehouse_id" text,
	"status" "order_status" DEFAULT 'booked' NOT NULL,
	"credit_flag" boolean DEFAULT false NOT NULL,
	"price_flag" boolean DEFAULT false NOT NULL,
	"flag_note" text,
	"notes" text,
	"lat" double precision,
	"lng" double precision,
	"total" integer DEFAULT 0 NOT NULL,
	"delivered_total" integer,
	"booked_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"packed_by" text,
	"packed_at" timestamp with time zone,
	"dispatched_by" text,
	"dispatched_at" timestamp with time zone,
	"delivery_person_id" text,
	"delivered_at" timestamp with time zone,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	CONSTRAINT "orders_orderNo_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"retailer_id" text NOT NULL,
	"amount" integer NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"reference" text,
	"notes" text,
	"order_id" text,
	"collected_by" text NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"status" "payment_status" NOT NULL,
	"received_by" text,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"category" text,
	"unit" text DEFAULT 'pc' NOT NULL,
	"case_size" integer DEFAULT 1 NOT NULL,
	"mrp" integer DEFAULT 0 NOT NULL,
	"base_price" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "purchase_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_id" text NOT NULL,
	"product_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"qty" integer NOT NULL,
	"rate" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_no" serial NOT NULL,
	"supplier_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"invoice_no" text,
	"invoice_date" date,
	"total" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchases_purchaseNo_unique" UNIQUE("purchase_no")
);
--> statement-breakpoint
CREATE TABLE "retailer_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"retailer_id" text NOT NULL,
	"price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retailer_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "retailer_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "retailers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_name" text,
	"phone" text,
	"address" text,
	"area" text,
	"gstin" text,
	"type_id" text,
	"default_warehouse_id" text,
	"credit_limit" integer,
	"credit_days" integer DEFAULT 15 NOT NULL,
	"opening_balance" integer DEFAULT 0 NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"status" "retailer_status" DEFAULT 'active' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"warehouse_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"qty" integer NOT NULL,
	"kind" "movement_kind" NOT NULL,
	"ref_id" text,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"gstin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "type_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type_id" text NOT NULL,
	"price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"pin_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouses_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_salesman_id_users_id_fk" FOREIGN KEY ("salesman_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_packed_by_users_id_fk" FOREIGN KEY ("packed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_person_id_users_id_fk" FOREIGN KEY ("delivery_person_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_collected_by_users_id_fk" FOREIGN KEY ("collected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_prices" ADD CONSTRAINT "retailer_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_prices" ADD CONSTRAINT "retailer_prices_retailer_id_retailers_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."retailers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_type_id_retailer_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."retailer_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_default_warehouse_id_warehouses_id_fk" FOREIGN KEY ("default_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_prices" ADD CONSTRAINT "type_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_prices" ADD CONSTRAINT "type_prices_type_id_retailer_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."retailer_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_order_line_id_index" ON "allocations" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "allocations_batch_id_index" ON "allocations" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "batches_product_id_warehouse_id_batch_no_index" ON "batches" USING btree ("product_id","warehouse_id","batch_no");--> statement-breakpoint
CREATE INDEX "batches_expiry_index" ON "batches" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "order_lines_order_id_index" ON "order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_lines_product_id_index" ON "order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_status_index" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_retailer_id_index" ON "orders" USING btree ("retailer_id");--> statement-breakpoint
CREATE INDEX "orders_salesman_id_index" ON "orders" USING btree ("salesman_id");--> statement-breakpoint
CREATE INDEX "orders_delivery_person_id_index" ON "orders" USING btree ("delivery_person_id");--> statement-breakpoint
CREATE INDEX "payments_retailer_id_index" ON "payments" USING btree ("retailer_id");--> statement-breakpoint
CREATE INDEX "payments_status_index" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_name_index" ON "products" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "retailer_prices_product_id_retailer_id_index" ON "retailer_prices" USING btree ("product_id","retailer_id");--> statement-breakpoint
CREATE INDEX "retailers_name_index" ON "retailers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "retailers_area_index" ON "retailers" USING btree ("area");--> statement-breakpoint
CREATE INDEX "stock_movements_product_id_index" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_created_at_index" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "type_prices_product_id_type_id_index" ON "type_prices" USING btree ("product_id","type_id");