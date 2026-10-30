-- Uploads belong to an account's library, so dedupe within an account only:
-- hashes and cutouts come from the browser unverified, and a shared pool
-- would let one person's upload stand in for another's. Guest uploads
-- (null owner) never collide.
ALTER TABLE "assets" DROP CONSTRAINT "assets_sha256_unique";--> statement-breakpoint
DROP INDEX "assets_source_variant_idx";--> statement-breakpoint
CREATE INDEX "assets_owner_created_idx" ON "assets" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_owner_sha256_idx" ON "assets" USING btree ("owner_id","sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_owner_source_variant_idx" ON "assets" USING btree ("owner_id","source_asset_id","variant");