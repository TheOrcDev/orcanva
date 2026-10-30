-- Images saved before filters existed have no "filter" key. Parsing fills in
-- null, so add it to the stored data too: live rows then match what clients
-- hold and skip re-validation.
UPDATE "design_elements"
SET "data" = "data" || '{"filter": null}'::jsonb
WHERE "data"->>'type' = 'image' AND NOT ("data" ? 'filter');
