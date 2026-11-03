-- Version history (see lib/db/schema.ts): snapshots of a design in
-- design_versions, and what the save statement needs to know when one is due.
CREATE TYPE "public"."design_version_kind" AS ENUM('auto', 'named', 'restore');--> statement-breakpoint
CREATE TABLE "design_versions" (
	"asset_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"background" jsonb NOT NULL,
	"content_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"created_by_name" text NOT NULL,
	"design_id" uuid NOT NULL,
	"doc_version" integer NOT NULL,
	"element_count" integer NOT NULL,
	"elements" jsonb NOT NULL,
	"height" integer NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "design_version_kind" NOT NULL,
	"name" text,
	"restored_from_id" uuid,
	"size_bytes" integer NOT NULL,
	"thumbnail_key" text,
	"width" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "last_version_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "last_writer" text;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "restore_seq" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "restored_by_name" text;--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_restored_from_id_design_versions_id_fk" FOREIGN KEY ("restored_from_id") REFERENCES "public"."design_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_versions_design_created_idx" ON "design_versions" USING btree ("design_id","created_at");--> statement-breakpoint
CREATE INDEX "design_versions_asset_ids_idx" ON "design_versions" USING gin ("asset_ids");--> statement-breakpoint
-- Hand-written, as in 0006: neon_auth."user" belongs to Neon Auth. A deleted
-- account's versions stay with the design, under the name they had.
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Snapshots are mostly repeated JSON: lz4 compresses them about as well as
-- the default and much faster, inside the save statement
ALTER TABLE "design_versions" ALTER COLUMN "elements" SET COMPRESSION lz4;
