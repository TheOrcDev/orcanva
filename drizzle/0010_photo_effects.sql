-- Photos saved before effects existed have no "outline", "glow" or
-- "shadow" keys. Parsing fills in null, so add them to the stored data too:
-- live rows then match what clients hold and skip re-validation. Keys a
-- row already has win over the nulls.
UPDATE "design_elements"
SET "data" = '{"glow": null, "outline": null, "shadow": null}'::jsonb || "data"
WHERE "data"->>'type' IN ('image', 'frame')
  AND NOT ("data" ?& ARRAY['glow', 'outline', 'shadow']);
