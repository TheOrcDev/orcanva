CREATE TABLE "design_pages" (
	"background" jsonb NOT NULL,
	"design_id" uuid NOT NULL,
	"id" text NOT NULL,
	"position" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "design_pages_design_id_id_pk" PRIMARY KEY("design_id","id")
);
--> statement-breakpoint
ALTER TABLE "design_elements" ADD COLUMN "page_id" text;--> statement-breakpoint
ALTER TABLE "design_presence" ADD COLUMN "page_id" text;--> statement-breakpoint
ALTER TABLE "design_versions" ADD COLUMN "pages" jsonb;--> statement-breakpoint
ALTER TABLE "design_pages" ADD CONSTRAINT "design_pages_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Hand-written backfill (plan 10.2): every design gets its one page, whose
-- id is the design's own, with the background the design had; every element
-- goes on it. Code from before pages keeps writing designs without a page
-- row and elements without a page: the app treats both as that same first
-- page, and the contract migration runs this again before page_id becomes
-- NOT NULL.
INSERT INTO "design_pages" ("design_id", "id", "position", "background")
SELECT "id", "id"::text, 'a0', COALESCE("background", '{"type":"solid","color":"#ffffff"}'::jsonb)
FROM "designs"
ON CONFLICT ("design_id", "id") DO NOTHING;--> statement-breakpoint
UPDATE "design_elements" SET "page_id" = "design_id"::text WHERE "page_id" IS NULL;
