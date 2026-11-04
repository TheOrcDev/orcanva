-- Contract (plan 10.3), once the code that reads and writes pages (10.2)
-- serves production. Hand-written around what drizzle-kit generated.
--
-- 1. The expand backfill again, for rows code from before pages wrote since:
-- designs without a page get theirs (the design's id), and elements without
-- a page, or on one that isn't there, go on their design's first page.
INSERT INTO "design_pages" ("design_id", "id", "position", "background")
SELECT d."id", d."id"::text, 'a0', COALESCE(d."background", '{"type":"solid","color":"#ffffff"}'::jsonb)
FROM "designs" d
WHERE NOT EXISTS (SELECT 1 FROM "design_pages" p WHERE p."design_id" = d."id")
ON CONFLICT ("design_id", "id") DO NOTHING;--> statement-breakpoint
UPDATE "design_elements" e
SET "page_id" = (
  SELECT p."id" FROM "design_pages" p
  WHERE p."design_id" = e."design_id"
  ORDER BY p."position" COLLATE "C", p."id" COLLATE "C"
  LIMIT 1
)
WHERE e."page_id" IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM "design_pages" p
    WHERE p."design_id" = e."design_id" AND p."id" = e."page_id"
  );--> statement-breakpoint
-- 2. Vercel's skew protection keeps serving Server Actions from deployments
-- older than 10.2 to tabs opened on them, for up to 12 hours: their Make a
-- copy, Copy & resize and template designs insert elements without a page.
-- Until 10.10 drops it, this puts such a row on its design's first page,
-- storing that page first when the design has none, so NOT NULL and the
-- foreign key below don't refuse them.
CREATE FUNCTION "design_elements_first_page"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "design_pages" ("design_id", "id", "position", "background")
  SELECT d."id", d."id"::text, 'a0', COALESCE(d."background", '{"type":"solid","color":"#ffffff"}'::jsonb)
  FROM "designs" d
  WHERE d."id" = NEW."design_id"
    AND NOT EXISTS (SELECT 1 FROM "design_pages" p WHERE p."design_id" = d."id")
  ON CONFLICT ("design_id", "id") DO NOTHING;
  NEW."page_id" := (
    SELECT p."id" FROM "design_pages" p
    WHERE p."design_id" = NEW."design_id"
    ORDER BY p."position" COLLATE "C", p."id" COLLATE "C"
    LIMIT 1
  );
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "design_elements_first_page"
BEFORE INSERT ON "design_elements"
FOR EACH ROW WHEN (NEW."page_id" IS NULL)
EXECUTE FUNCTION "design_elements_first_page"();--> statement-breakpoint
-- 3. Every element on a page, and a deleted page takes its elements with it
ALTER TABLE "design_elements" ALTER COLUMN "page_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "design_elements" ADD CONSTRAINT "design_elements_page_fk" FOREIGN KEY ("design_id","page_id") REFERENCES "public"."design_pages"("design_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "design_elements" VALIDATE CONSTRAINT "design_elements_page_fk";
