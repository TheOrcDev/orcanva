CREATE TYPE "public"."asset_variant" AS ENUM('no-background');--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "source_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "variant" "asset_variant";--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_asset_id_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_source_variant_idx" ON "assets" USING btree ("source_asset_id","variant");