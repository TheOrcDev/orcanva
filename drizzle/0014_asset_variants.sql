ALTER TYPE "public"."asset_variant" ADD VALUE 'erased' BEFORE 'no-background';--> statement-breakpoint
ALTER TYPE "public"."asset_variant" ADD VALUE 'upscaled-2x';--> statement-breakpoint
ALTER TYPE "public"."asset_variant" ADD VALUE 'upscaled-4x';--> statement-breakpoint
DROP INDEX "assets_owner_source_variant_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "assets_owner_source_variant_idx" ON "assets" USING btree ("owner_id","source_asset_id","variant") WHERE "assets"."variant" >= 'no-background';