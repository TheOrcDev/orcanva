// The MCP server's reads and writes. Writes go through changesStatement, the
// same statement the editor's save route runs, so access checks, pages,
// version history and live updates to open editors all behave exactly as
// for a person editing.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, desc, eq, or, sql } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import sharp from "sharp";
import type { Sharp } from "sharp";

import { comparePositioned } from "@/lib/collab/positions";
import { getDb } from "@/lib/db/client";
import { changesStatement } from "@/lib/db/queries/changes";
import { getDesignContent, sharedWith } from "@/lib/db/queries/designs";
import type { DesignContent } from "@/lib/db/queries/designs";
import { insertNewDesign } from "@/lib/db/queries/new-design";
import { finishSnapshot } from "@/lib/db/queries/versions";
import { assets, designs } from "@/lib/db/schema";
import type { ChangesWrites } from "@/lib/document/changes-payload";
import { createDocument } from "@/lib/document/factories";
import type { Background } from "@/lib/document/schema";
import { MAX_UPLOAD_BYTES, assetKey } from "@/lib/storage/keys";
import type { UploadMimeType } from "@/lib/storage/keys";
import { getObject, putObject } from "@/lib/storage/s3";
import { templateAssetRow } from "@/lib/templates/assets";
import { instantiateTemplate } from "@/lib/templates/instantiate";
import { readTemplate } from "@/lib/templates/read";
import { MAX_IMAGE_SIDE, displayName } from "@/lib/upload/prepare-image";

export interface Viewer {
  id: string;
  name: string;
}

// One editor session for the server's whole run, as one browser tab is
export const CLIENT_ID = crypto.randomUUID();

let viewer: Promise<Viewer> | null = null;

const findViewer = async (): Promise<Viewer> => {
  const email = process.env.ORCANVA_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      "Set ORCANVA_EMAIL to the email of your Orcanva account (in the MCP server's env)"
    );
  }
  const result = await getDb().execute<{ id: string; name: string | null }>(
    sql`SELECT id, name FROM neon_auth."user" WHERE lower(email) = ${email} LIMIT 1`
  );
  const [row] = result.rows;
  if (!row) {
    throw new Error(`No Orcanva account for ${email}; sign up with it first`);
  }
  return { id: row.id, name: row.name ?? "Agent" };
};

// The account the agent acts as, looked up once
export const getViewer = async (): Promise<Viewer> => {
  viewer ??= findViewer();
  try {
    return await viewer;
  } catch (error) {
    // Let the next call try again (e.g. after signing up)
    viewer = null;
    throw error;
  }
};

export const designUrl = (id: string): string => {
  const base = (process.env.ORCANVA_URL ?? "http://localhost:3000").replace(
    /\/+$/u,
    ""
  );
  return `${base}/design/${id}`;
};

export interface DesignListItem {
  id: string;
  name: string;
  width: number;
  height: number;
  visibility: string;
  updatedAt: Date;
  url: string;
}

const LIST_LIMIT = 50;

// The account's own designs and the ones shared with it, newest first
export const listDesigns = async (): Promise<DesignListItem[]> => {
  const { id } = await getViewer();
  const rows = await getDb()
    .select({
      height: designs.height,
      id: designs.id,
      name: designs.name,
      updatedAt: designs.updatedAt,
      visibility: designs.visibility,
      width: designs.width,
    })
    .from(designs)
    .where(or(eq(designs.ownerId, id), sharedWith(id)))
    .orderBy(desc(designs.updatedAt))
    .limit(LIST_LIMIT);
  return rows.map((row) => ({ ...row, url: designUrl(row.id) }));
};

// A private design of the account's own with one page, blank or from a
// template (as "Start from" does)
export const createDesign = async (input: {
  name: string;
  width: number;
  height: number;
  background: Background | null;
  templateId: string | null;
}): Promise<{ id: string }> => {
  const { id: ownerId } = await getViewer();
  const size = { height: input.height, width: input.width };
  let document = createDocument(size);
  let assetRows: (typeof assets.$inferInsert)[] = [];
  if (input.templateId) {
    const template = await readTemplate(input.templateId);
    // At the size asked for; templates scale to any size
    document = instantiateTemplate(template.document, size);
    assetRows = template.assets.map(templateAssetRow);
  }
  const id = crypto.randomUUID();
  await insertNewDesign({
    assetRows,
    document: input.background
      ? { ...document, background: input.background }
      : document,
    id,
    name: input.name,
    ownerId,
    visibility: "private",
  });
  return { id };
};

// A design's content, when the account may open it (as the editor checks)
export const readDesign = async (id: string): Promise<DesignContent> => {
  const { id: viewerId } = await getViewer();
  const [visible] = await getDb()
    .select({ id: designs.id })
    .from(designs)
    .where(
      and(
        eq(designs.id, id),
        or(
          eq(designs.visibility, "public"),
          eq(designs.ownerId, viewerId),
          sharedWith(viewerId)
        )
      )
    )
    .limit(1);
  const content = visible ? await getDesignContent(id) : null;
  if (!content) {
    throw new Error(`Design ${id} not found (or not yours); see list_designs`);
  }
  return content;
};

export const pageOf = (content: DesignContent, pageId: string | undefined) => {
  if (!pageId) {
    const [first] = content.pages;
    if (!first) {
      throw new Error("Design has no pages");
    }
    return first;
  }
  const page = content.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    throw new Error(
      `No page ${pageId}; pages are ${content.pages.map((p) => p.id).join(", ")}`
    );
  }
  return page;
};

// Every element on every page with its page and z-order key
export const allElements = (content: DesignContent) =>
  content.pages.flatMap((page) =>
    page.document.elements.map((element) => ({
      element,
      pageId: page.id,
      position: page.positions[element.id] ?? "a0",
    }))
  );

// Z-order keys for `count` new elements above (or below) everything
export const newPositions = (
  content: DesignContent,
  count: number,
  where: "front" | "back" = "front"
): string[] => {
  const sorted = allElements(content)
    .map(({ element, position }) => ({ id: element.id, position }))
    .toSorted(comparePositioned);
  if (where === "back") {
    return generateNKeysBetween(null, sorted[0]?.position ?? null, count);
  }
  return generateNKeysBetween(sorted.at(-1)?.position ?? null, null, count);
};

export const emptyWrites = (): ChangesWrites => ({
  deletes: [],
  firstPageBackground: null,
  name: null,
  pageDeletes: [],
  pages: [],
  size: null,
  writes: [],
});

// Saves one batch as the editor's save route does
export const applyChanges = async (
  designId: string,
  changes: Partial<ChangesWrites>
): Promise<void> => {
  const current = await getViewer();
  const result = await getDb().execute<{
    found: number;
    snapshot_id: string | null;
    txid: string;
  }>(
    changesStatement({
      ...emptyWrites(),
      ...changes,
      clientId: CLIENT_ID,
      designId,
      viewer: current,
    })
  );
  const [row] = result.rows;
  if (!row?.found) {
    throw new Error(`Design ${designId} not found (or not editable)`);
  }
  if (row.snapshot_id) {
    await finishSnapshot(designId, row.snapshot_id).catch(() => null);
  }
};

// Files sharp reads and Orcanva shows as they are; anything else becomes
// a PNG
const KEEP_FORMATS: Record<string, UploadMimeType> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

// The browser's re-encoding quality (lib/upload/prepare-image.ts)
const REENCODE_QUALITY = 92;

// How a file that has to be redrawn is written: GIFs become PNGs, as in
// the browser
const ENCODERS: Record<UploadMimeType, (image: Sharp) => Sharp> = {
  "image/gif": (image) => image.png(),
  "image/jpeg": (image) => image.jpeg({ quality: REENCODE_QUALITY }),
  "image/png": (image) => image.png(),
  "image/webp": (image) => image.webp({ quality: REENCODE_QUALITY }),
};

const readSource = async (source: string): Promise<Uint8Array> => {
  if (/^https?:\/\//iu.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Couldn't download ${source} (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  if (!path.isAbsolute(source)) {
    throw new Error("Give an absolute file path or an http(s) URL");
  }
  return new Uint8Array(await readFile(source));
};

export interface UploadedImage {
  id: string;
  width: number;
  height: number;
}

// The image as the editor would upload it: a format Orcanva shows, no
// bigger than MAX_IMAGE_SIDE, with its size as displayed
const prepareUpload = async (source: string) => {
  const original = await readSource(source);
  const meta = await sharp(original).metadata();
  const { width, height } = meta;
  if (!(width && height)) {
    throw new Error("Couldn't read the image's size");
  }
  const kept = meta.format ? KEEP_FORMATS[meta.format] : undefined;
  const oversized = Math.max(width, height) > MAX_IMAGE_SIDE;

  let bytes = original;
  let mimeType = kept ?? "image/png";
  // Rotated phone photos: the size as displayed
  let size =
    (meta.orientation ?? 1) >= 5
      ? { height: width, width: height }
      : { height, width };
  if (oversized || !kept) {
    if (mimeType === "image/gif") {
      mimeType = "image/png";
    }
    // Turned upright first, since the new file keeps no orientation
    const image = sharp(original).rotate();
    const { data, info } = await ENCODERS[mimeType](
      oversized
        ? image.resize({
            fit: "inside",
            height: MAX_IMAGE_SIDE,
            width: MAX_IMAGE_SIDE,
          })
        : image
    ).toBuffer({ resolveWithObject: true });
    bytes = new Uint8Array(data);
    size = { height: info.height, width: info.width };
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Image is over 25 MB");
  }
  return { bytes, mimeType, size };
};

// Puts an image in the account's library, as an upload from the editor
// would: one copy per file per account, matched by its SHA-256. The row is
// reserved before the file goes up and marked ready after, so a failure
// leaves a pending row (which a retry completes), never a file nobody has.
export const uploadImage = async (source: string): Promise<UploadedImage> => {
  const { id: ownerId } = await getViewer();
  const { bytes, mimeType, size } = await prepareUpload(source);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const db = getDb();
  const sameFile = and(eq(assets.ownerId, ownerId), eq(assets.sha256, sha256));
  const existing = async () => {
    const [row] = await db
      .select({
        height: assets.height,
        id: assets.id,
        key: assets.key,
        mimeType: assets.mimeType,
        status: assets.status,
        width: assets.width,
      })
      .from(assets)
      .where(sameFile)
      .limit(1);
    return row;
  };

  let row = await existing();
  if (!row) {
    const id = crypto.randomUUID();
    await db
      .insert(assets)
      .values({
        ...size,
        id,
        key: assetKey(id, mimeType),
        mimeType,
        originalName: displayName(
          path.basename(new URL(source, "file:///").pathname)
        ),
        ownerId,
        sha256,
        sizeBytes: bytes.byteLength,
      })
      // An upload of the same file may have won the race
      .onConflictDoNothing();
    row = await existing();
  }
  if (!row) {
    throw new Error("Couldn't reserve the upload");
  }
  if (row.status !== "ready") {
    await putObject(row.key, bytes, row.mimeType);
    await db
      .update(assets)
      .set({
        sizeBytes: bytes.byteLength,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(assets.id, row.id));
  }
  return { height: row.height, id: row.id, width: row.width };
};

// The design's latest gallery picture, which an open editor renders after
// edits; null when none has been made yet
export const readThumbnail = async (
  designId: string
): Promise<{ data: string; mimeType: string } | null> => {
  const [row] = await getDb()
    .select({ key: designs.thumbnailKey })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!row?.key) {
    return null;
  }
  const object = await getObject(row.key);
  const body = await object.Body?.transformToByteArray();
  if (!body) {
    return null;
  }
  return {
    data: Buffer.from(body).toString("base64"),
    mimeType: object.ContentType ?? "image/jpeg",
  };
};
