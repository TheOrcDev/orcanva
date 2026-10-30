# Orcanva

A personal, Canva-style editor for YouTube thumbnails and social images.

- Pick a canvas size (YouTube thumbnail, Full HD, 4K, square, story, … or custom)
- Upload images (button, drag from the desktop, or paste a screenshot) and move, scale, rotate, and flip them
- One-click **Remove background** for any image, run by an open-source model in your browser (no API key, no per-image cost)
- Text with 40 curated Google Fonts, inline editing, outline, drop shadow, and highlight effects
- Shapes, lines, arrows, solid or gradient backgrounds, and a drag-to-reorder layers panel
- Undo/redo, autosave, and download as PNG, JPG, or WebP at exact pixel size (1× or 2×)
- **Live collaboration**: open a design in several windows (or on several machines) and see everyone's cursors, selections, and edits as they happen
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
NEON_AUTH_BASE_URL=https://…/neondb/auth  # see "Accounts" below
NEON_AUTH_COOKIE_SECRET=…              # openssl rand -base64 32
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

### Accounts

Sign-in uses [Neon Auth](https://neon.com/docs/auth/overview) (Managed Better Auth), with Google and email + password. Users live in the branch's own `neon_auth` schema. Enable it on the branch, add the app's domain, and copy the base URL into `NEON_AUTH_BASE_URL`:

```bash
neon neon-auth enable --project-id <project> --branch main
neon neon-auth domain add https://my.app --project-id <project> --branch main
neon neon-auth status --project-id <project> --branch main   # shows base_url
```

`NEON_AUTH_COOKIE_SECRET` is your own random string (32+ characters) that signs the session cache cookie; keep it the same across deployments. Localhost is trusted by default. Google works out of the box on Neon's shared OAuth app, which shows Neon's name on the consent screen; add your own Google OAuth app (redirect URI `{NEON_AUTH_BASE_URL}/callback/google`) before a real launch.

### Realtime

Live collaboration uses [Neon Realtime](https://neon.com/docs/realtime/overview) (beta, needs one of the regions above). Enable it on the branch and pull its two variables into `.env.local`:

```bash
npx neon@latest realtime enable --project-id <project>
npx neon@latest env pull --project-id <project> --service realtime --file .env.local
```

Without them the editor still works and saves, just without live updates.

Allowed origins are left at the default (any origin): the app has no accounts yet, so the real gate is the sealed query, a short-lived token for one design's rows that only this server can mint.

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
- `lib/editor/` holds the per-editor zustand store, transactional undo history (a drag, slider scrub, or text edit is one step), and transform baking.
- `components/editor/canvas/` is the Konva workspace. Exports render an offscreen clone of the page at exact size after fonts and images load (`lib/export/`).
- Each element is its own row in `design_elements` with a fractional-index `position` for z-order, so people editing different elements never overwrite each other (`lib/collab/positions.ts`). Edits become per-element change sets (`lib/collab/changeset.ts`); undo replays your own change sets on top of the current document, so it never reverts someone else's work.
- The outbox (`lib/collab/outbox.ts`) sends writes about every 100 ms to `POST /api/designs/[id]/changes`, which applies a batch in one statement and returns its transaction id. Creates upsert, updates only touch rows that still exist (a delete wins over a concurrent edit), and the last write to an element wins.
- Live updates come from three [Neon Realtime](https://neon.com/docs/realtime/overview) live queries per design (page row, element rows, presence rows), sealed on the server (`lib/realtime/server.ts`) and renewed through `POST /api/designs/[id]/live`. The editor shows the server's rows with its own unconfirmed writes on top (`lib/collab/sync-state.ts`) and keeps each write there until its transaction comes back on the live query, so a lagging result after a reconnect can't hide your own edits. If the connection drops for good, a watchdog starts a fresh session.
- Cursors, selections, and in-progress drags are rows in `design_presence`, written about 10 times a second while you move (`PUT /api/designs/[id]/presence`, with a heartbeat every 5 s) and read by the presence live query. Positions are in page coordinates, so they line up at any zoom.
- Gallery thumbnails upload to `PUT /api/designs/[id]/thumbnail`, rendered by whichever window made the change.
- Uploads are deduplicated by SHA-256 and form one library shared by every design.
