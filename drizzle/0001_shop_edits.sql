ALTER TABLE "orders" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "photo" text;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "retailers" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;