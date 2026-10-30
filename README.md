# Orcanva

A personal, Canva-style editor for YouTube thumbnails and social images.

- Pick a canvas size (YouTube thumbnail, Full HD, 4K, square, story, … or custom)
- Upload images (button, drag from the desktop, or paste a screenshot) and move, scale, rotate, and flip them
- One-click **Remove background** for any image, run by an open-source model in your browser (no API key, no per-image cost)
- Text with 40 curated Google Fonts, inline editing, outline, drop shadow, and highlight effects
- Shapes, lines, arrows, solid or gradient backgrounds, and a drag-to-reorder layers panel
- Undo/redo, autosave, and download as PNG, JPG, or WebP at exact pixel size (1× or 2×)
- A gallery of every design with previews; **Use as template** copies one so you can change the content

Built with Next.js 16, React 19, Konva, Tailwind v4, shadcn/ui (Base UI), Drizzle, and Neon (Postgres + Object Storage). There is no authentication yet: don't deploy it publicly without protecting it.

## Setup

Requires Node 24 and pnpm.

```bash
pnpm install
```

### Environment

Create `.env.local` (gitignored) with your Neon project's values:

```bash
DATABASE_URL=postgresql://…            # neon connection-string
AWS_ACCESS_KEY_ID=…                    # neon credentials create --scope storage:read --scope storage:write
AWS_SECRET_ACCESS_KEY=…
AWS_ENDPOINT_URL_S3=https://<branch>.storage.<cell>.<region>.aws.neon.tech
AWS_REGION=eu-central-1
STORAGE_BUCKET=orcanva-assets
NEON_REALTIME_URL=wss://…              # optional, see "Realtime" below
NEON_REALTIME_SECRET=…
```

The storage endpoint and region come from `neon api /projects/<project>/branches/<branch>/storage`. Object Storage needs a project in `aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1`, or `aws-ap-southeast-1`.

### Database and storage

```bash
pnpm db:migrate                     # apply Drizzle migrations
pnpm storage:setup                  # allow browser uploads from any origin and smoke-test them
pnpm storage:setup https://my.app   # or restrict uploads to specific origins
```

Browsers upload straight to the private bucket with short-lived presigned URLs. If the bucket's CORS doesn't allow the page's origin, uploads fall back to going through the app (`PUT /api/assets/[id]/file`), so they work on any dev port. Images are read back through the same-origin `/api/storage/*` route, which keeps exports from being tainted.

### Realtime

Live collaboration uses [Neon Realtime](https://neon.com/docs/realtime/overview) (beta, needs one of the regions above). Enable it on the branch and pull its two variables into `.env.local`:

```bash
npx neon@latest realtime enable --project-id <project>
npx neon@latest env pull --project-id <project> --service realtime --file .env.local
```

Without them the editor still works and saves, just without live updates.

### Run

```bash
pnpm dev
```

### Background removal

Uses [BEN2](https://huggingface.co/onnx-community/BEN2-ONNX), whose weights are MIT-licensed so commercial use is fine, through [Transformers.js](https://huggingface.co/docs/transformers.js) on the visitor's GPU via WebGPU (recent Chrome, Edge, or Safari on a GPU with half-precision support). It runs in a Web Worker, not on the server: at its fixed 1024px input it needs several GB of memory, more than serverless functions get. The first removal downloads the model (~220 MB) into the browser's cache. After that, each image takes a few seconds. The cutout is uploaded as a new transparent PNG in your library and linked to its source, so repeating the removal is instant and **Restore original** can switch back.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `pnpm format` | Ultracite (oxlint + oxfmt) check / fix |
| `pnpm typecheck` | `next typegen` then `tsc` |
| `pnpm test` | Vitest unit tests (document model, history, …) |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations from `lib/db/schema.ts` |
| `pnpm storage:setup [origins…]` | Bucket CORS + upload smoke test |

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ⌘C / ⌘X / ⌘V | Copy / cut / paste elements; ⌘V with an image uploads it |
| ⌘D | Duplicate |
| Delete / Backspace | Delete selection |
| Arrows (⇧ for 10px) | Nudge |
| ⌘] / ⌘[ (⇧ for front/back) | Bring forward / send backward |
| Enter or double-click | Edit selected text |
| Shift while resizing | Images: free stretch; shapes: keep ratio |
| ⌘+ / ⌘− / ⌘0 | Zoom in / out / fit |
| Scroll / pinch (⌘-scroll) | Pan / zoom at pointer |

## How it fits together

- `lib/document/` is the versioned, zod-validated design document (elements, background, size) with migrations and factories.
- `lib/editor/` holds the per-editor zustand store, transactional undo history (a drag, slider scrub, or text edit is one step), autosave, and transform baking.
- `components/editor/canvas/` is the Konva workspace. Exports render an offscreen clone of the page at exact size after fonts and images load (`lib/export/`).
- Designs autosave to `PUT /api/designs/[id]`. Gallery thumbnails upload to `PUT /api/designs/[id]/thumbnail`.
- Uploads are deduplicated by SHA-256 and form one library shared by every design.
