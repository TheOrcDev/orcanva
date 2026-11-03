-- Brand kits: an account's saved colours, fonts and logos (see lib/db/schema.ts).
CREATE TYPE "public"."brand_kit_item_kind" AS ENUM('color', 'font', 'logo');--> statement-breakpoint
CREATE TABLE "brand_kit_items" (
	"asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "brand_kit_item_kind" NOT NULL,
	"owner_id" uuid NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_kit_items" ADD CONSTRAINT "brand_kit_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_kit_items_owner_kind_value_idx" ON "brand_kit_items" USING btree ("owner_id","kind","value");--> statement-breakpoint
CREATE INDEX "brand_kit_items_owner_created_idx" ON "brand_kit_items" USING btree ("owner_id","created_at");--> statement-breakpoint
-- Hand-written, as in 0006: neon_auth."user" belongs to Neon Auth. A deleted
-- account takes its brand kit with it.
ALTER TABLE "brand_kit_items" ADD CONSTRAINT "brand_kit_items_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;
