-- Move each design's elements out of the document blob into rows. Keys are
-- the ones fractional-indexing generates for n items from scratch
-- (a0 … az, b00 …), so array order becomes z-order.
INSERT INTO "design_elements" ("design_id", "id", "position", "data")
SELECT
  d."id",
  e.value->>'id',
  CASE
    WHEN e.ord - 1 < 62 THEN 'a' || substr(digits.chars, (e.ord - 1)::int + 1, 1)
    ELSE 'b'
      || substr(digits.chars, ((e.ord - 1 - 62) / 62)::int + 1, 1)
      || substr(digits.chars, ((e.ord - 1 - 62) % 62)::int + 1, 1)
  END,
  e.value
FROM "designs" d
CROSS JOIN LATERAL jsonb_array_elements(d."document"->'elements') WITH ORDINALITY AS e(value, ord)
CROSS JOIN (SELECT '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'::text AS chars) digits
WHERE d."document" IS NOT NULL
ON CONFLICT ("design_id", "id") DO NOTHING;
--> statement-breakpoint
UPDATE "designs"
SET
  "background" = "document"->'background',
  "version" = COALESCE(("document"->>'version')::int, 1)
WHERE "document" IS NOT NULL AND "background" IS NULL;
