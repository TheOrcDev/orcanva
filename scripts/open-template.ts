// Makes a private design from a template file for an account, so the
// template can be changed in the editor and exported again with
// `pnpm template:export`. Uses the same code as "Start from" a template.
//
// Usage: pnpm template:open <template id> <email>   (sign up with it first)
import { readFileSync } from "node:fs";
import path from "node:path";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { findPresetById } from "@/lib/document/presets";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import { templateAssetRow } from "@/lib/templates/assets";
import {
  initialPositions,
  instantiateTemplate,
} from "@/lib/templates/instantiate";
import { templateIdSchema, templateSchema } from "@/lib/templates/schema";

config({ path: ".env.local", quiet: true });

const ROOT = path.resolve(import.meta.dirname, "..");

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const main = async () => {
  const id = templateIdSchema.parse(process.argv[2]);
  const email = process.argv[3]?.trim().toLowerCase();
  const url = process.env.DATABASE_URL;
  if (!email) {
    throw new Error("Usage: pnpm template:open <template id> <email>");
  }
  if (!url) {
    throw new Error("DATABASE_URL is missing; add it to .env.local");
  }

  const template = templateSchema.parse(
    JSON.parse(
      readFileSync(path.join(ROOT, "lib/templates/data", `${id}.json`), "utf-8")
    )
  );
  const preset = findPresetById(template.presetId);
  if (!preset) {
    throw new Error(`No size preset ${template.presetId}`);
  }
  const document = instantiateTemplate(template.document, preset);
  const positions = initialPositions(document.elements.length);

  const sql = neon(url);
  const [user] = await sql`
    SELECT id FROM neon_auth."user" WHERE lower(email) = ${email}
  `;
  if (!user) {
    throw new Error(`No account for ${email}; sign up with it first`);
  }

  const designId = crypto.randomUUID();
  await sql.transaction([
    ...template.assets.map((asset) => {
      const row = templateAssetRow(asset);
      return sql`
        INSERT INTO assets (id, key, mime_type, original_name, owner_id, origin, size_bytes, status, width, height)
        VALUES (${row.id}, ${row.key}, ${row.mimeType}, ${row.originalName}, NULL, 'template', ${row.sizeBytes}, 'ready', ${row.width}, ${row.height})
        ON CONFLICT DO NOTHING`;
    }),
    sql`
      INSERT INTO designs (id, name, width, height, background, owner_id, version, visibility)
      VALUES (${designId}, ${template.name}, ${document.width}, ${document.height}, ${JSON.stringify(document.background)}::jsonb, ${user.id}, ${DOCUMENT_VERSION}, 'private')`,
    ...document.elements.map(
      (element, index) => sql`
        INSERT INTO design_elements (design_id, id, data, position)
        VALUES (${designId}, ${element.id}, ${JSON.stringify(element)}::jsonb, ${positions[index] ?? ""})`
    ),
  ]);
  log(`Opened ${id} for ${email}: /design/${designId}`);
};

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
