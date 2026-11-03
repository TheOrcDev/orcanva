# Orcanva

A free and open-source, Canva-style editor for YouTube thumbnails and social images.

- Pick a canvas size (YouTube thumbnail, Full HD, 4K, square, story, … or custom)
- **Crop the page**: press Crop next to Resize and drag the box (or its handles) over the part to keep, freely or locked to the original shape, 1:1, 4:5, 16:9 or 9:16, snapping to elements and the page centre; everything stays where it is on screen, and anything left outside stays in Layers, off the page
- Upload images (button, drag from the desktop, or paste a screenshot) and move, scale, rotate, and flip them
- **Crop** photos: drag a side handle to crop that side, or double-click one (or press Crop) to drag the frame's handles, slide the photo under it and zoom; Enter keeps it, Esc puts it back
- **Frames**: circles, stars, hearts and more from the Shapes tab; drop a photo on one (or drag an image onto it) to fill it, double-click to move or zoom it inside, and resizing keeps the photo covering the frame
- One-click **Remove background** for any image, run by an open-source model in your browser (no API key, no per-image cost)
- Instagram-style **filters** for images: 11 one-tap looks previewed on your own photo, with an intensity slider, plus brightness, contrast, highlights, shadows, saturation, warmth, tint, fade, vignette, sharpen, grain, and blur
- **Outline, glow and drop shadow** for photos and frames: the classic thumbnail cut-out look, a thick white (or any colour) outline that follows a background-removed photo's edge, an outer glow and a drop shadow, as one-tap looks (Sticker, Outline, Glow, Neon, Shadow) previewed on your own photo or set one by one; they grow with the photo, follow its crop, flips, corners and frame shape, and show while you drag, in downloads and in previews
- Text with 40 curated Google Fonts, inline editing (select words to change just their font, size, colour, weight, italic, underline or strikethrough), solid or gradient fills, underline and strikethrough, curved text, Canva-style effects (Hollow, Splice, Echo, Glitch, Neon, Lift), outline, drop shadow, and highlight
- Shapes, lines, arrows, solid or gradient backgrounds, and a drag-to-reorder layers panel
- **Graphics**: a tab to search about 6,000 icons, 1,500 emoji and our own stickers (or pick from a set made for thumbnails: arrows, circles, ❌ and ✅, badges, shocked faces, fire), filtered by kind, and add them with a click or by dragging them onto the canvas; the stickers are in the Shapes tab too. Graphics are vector art that stays sharp at any size and in downloads, flip, and keep their shape as they're resized. Each colour in a graphic is a swatch to change (an icon has one, an emoji several, and every part sharing a colour follows it), outline icons and drawn stickers have a line weight, any graphic can get a die-cut outline in any colour, and Reset colors brings back its own
- A colour picker with an **eyedropper** that picks any colour off the screen (Chrome, Edge and Opera on the desktop), keeping the colour's transparency, plus the colours already in the design (most-used first) and the ones you picked recently in this browser
- A **brand kit** for your account: its colours come first in every colour picker (**+** saves the one you're on), its fonts sit on top of the font picker (the star beside it adds or removes the current font), and its logos lead the Uploads tab (star any upload to add it); manage it all under Settings
- **Select several** elements with Shift-click, ⌘A, or a box dragged across empty canvas, then move, scale (from the corners) or rotate them together; align them to each other or to the page, space them evenly, and bring them forward or back as a block
- **Groups** (⌘G): a group selects, moves, scales, aligns and duplicates as one; click a grouped element again to change just that one
- **Smart guides**: dragged elements snap their edges and centres to the page and to each other, and to equal spacing with their neighbours; resize handles and line ends snap too
- Undo/redo, autosave, and download as PNG, JPG, or WebP at exact pixel size (1× or 2×)
- **Preview** a thumbnail the way viewers will see it: Preview (next to Download) draws the design into mock video pages (the home grid, search results, the Up next column and a phone's feed) at its real on-screen size, among other videos, in light or dark, with the title, channel, channel picture and video length you give it, and the length badge over the bottom-right corner; it only shrinks when the window is too narrow, and says so, and designs that aren't 16:9 show between black bars. Compare it with up to three other thumbnails, images from your device (never uploaded) or your other designs, mixed into the feed or side by side. Two switches keep it going while you edit: a live Up next preview in a corner of the canvas, and the length badge drawn on the canvas where it lands. The details stay in this browser, the title per design
- **Live collaboration**: open a design in several windows (or on several machines) and see everyone's cursors, selections, and edits as they happen
- **Accounts** (Google or email + password): your designs are private unless you make them public, and your uploads form your own library; change your name and avatar under Settings in the account menu, and keep your brand kit there: up to 24 colours, 10 fonts and 12 logos picked from your uploads
- **Public designs** anyone can open and edit together, signed in or not; only their owner can rename, delete, or make them private
- **Share with people**: invite anyone by email from a design's Share menu, public or private; they get an email (through Resend) with a link that walks newcomers through creating an account with that address, and the owner sees who joined and can remove them
- The **studio**: a gallery of your designs, the ones shared with you, and everyone's public ones, with previews; **Use as template** makes a private copy you can change
- A landing page that explains all of the above
- Pages for what people search for: a free **background remover**, **AI metadata remover** and **YouTube thumbnail preview** anyone can use without an account, a maker page for every kind of image (YouTube thumbnail, Instagram post and Story, LinkedIn banner, Open Graph, X post), a social media image sizes cheat sheet, and comparisons with Canva and remove.bg

Built with Next.js 16, React 19, Konva, Tailwind v4, shadcn/ui (Base UI), Drizzle, and Neon (Postgres, Auth, Realtime, and Object Storage).

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
RESEND_API_KEY=re_…                    # optional, sends share invites; see "Sharing" below
EMAIL_FROM="Orcanva <hello@example.com>"  # optional, at a domain verified in Resend
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

`NEON_AUTH_COOKIE_SECRET` is your own random string (32+ characters) that signs the session cache cookie; keep it the same across deployments. Localhost is trusted by default. Google works out of the box on Neon's shared OAuth app, which shows Neon's name on the consent screen.

Designs and uploads made before accounts existed have no owner: they stay public, and nobody can rename or delete them until you hand them to an account (sign up with that email first):

```bash
pnpm claim-designs you@example.com
```

Before a real launch, from Neon's [production checklist](https://neon.com/docs/auth/production-checklist):

- Your own Google OAuth app, with redirect URI `{NEON_AUTH_BASE_URL}/callback/google`
- Your own SMTP provider (Neon's shared sender is rate-limited), then turn on email verification
- Turn off "Allow localhost" once development uses its own Neon branch

### Sharing

Invites go out through [Resend](https://resend.com). Without `RESEND_API_KEY`, sharing still works but no email is sent, and the owner is told so. `EMAIL_FROM` must be at a domain verified in Resend; it defaults to `Orcanva <orcanva@orcdev.com>`. Invite links always point at production (`SITE_URL` in `lib/site.ts`) from production builds, and at the local server in dev.

### Realtime

Live collaboration uses [Neon Realtime](https://neon.com/docs/realtime/overview) (beta, needs one of the regions above). Enable it on the branch and pull its two variables into `.env.local`:

```bash
npx neon@latest realtime enable --project-id <project>
npx neon@latest env pull --project-id <project> --service realtime --file .env.local
```

Without them the editor still works and saves, just without live updates.

Allowed origins are left at the default (any origin): the real gate is the sealed query, a short-lived token for one design's rows that this server only mints for people who may open the design, and re-checks on every renewal (about once a minute).

### Run

```bash
pnpm dev
```

The landing page is at `/`, the studio at `/studio`, and the editor at `/design/[id]`.

### Background removal

Uses [BEN2](https://huggingface.co/onnx-community/BEN2-ONNX), whose weights are MIT-licensed so commercial use is fine, through [Transformers.js](https://huggingface.co/docs/transformers.js) on the visitor's GPU via WebGPU (recent Chrome, Edge, or Safari on a GPU with half-precision support). It runs in a Web Worker, not on the server: at its fixed 1024px input it needs several GB of memory, more than serverless functions get. The first removal downloads the model (~220 MB) into the browser's cache. After that, each image takes a few seconds. The cutout is uploaded as a new transparent PNG in your library and linked to its source, so repeating the removal is instant and **Restore original** can switch back.

### Graphics

Icons are [Tabler Icons](https://tabler.io/icons) (MIT), emoji are [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) in their flat style (MIT), and the stickers are Orcanva's own, released as CC0. `pnpm graphics:build` (`scripts/build-graphics.ts`) turns them into a catalog in `public/graphics/<hash>/`: an `index.json` of every graphic's id, kind, name and keywords, its art in shards of about 70 KB, and `NOTICES.txt` with both MIT licences. `lib/graphics/normalize.ts` makes each SVG drawable from flat paths: shapes become paths, transforms are applied, inherited and `currentColor` paint becomes palette entries, and coordinates are rounded to two decimals; gradients, masks, clip paths, filters, `<use>`, text and images are left out (about 80 emoji are, mostly for having more than 16 colours). The output is committed, so builds need no network. Tabler comes from `node_modules/@tabler/icons`; for the emoji only their names, keywords and upstream commit are kept (`assets/graphics/fluent-flat/metadata.json`), and their art carries over from the last catalog, so after changing the normalizer redraw them with `pnpm graphics:build --fluent <checkout of fluentui-emoji at that commit>` (a sparse checkout of `/LICENSE`, `assets/*/metadata.json` and the flat SVGs is enough).

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `pnpm format` | Ultracite (oxlint + oxfmt) check / fix |
| `pnpm typecheck` | `next typegen` then `tsc` |
| `pnpm test` | Vitest unit tests (document model, history, …) |
| `pnpm db:generate` / `db:migrate` | Drizzle migrations from `lib/db/schema.ts` |
| `pnpm storage:setup [origins…]` | Bucket CORS + upload smoke test |
| `pnpm claim-designs <email>` | Give ownerless (pre-accounts) designs and uploads to an account |
| `pnpm graphics:build [--fluent <checkout>]` | Rebuild the icons, emoji and stickers catalog in `public/graphics/` |

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| ⌘Z / ⇧⌘Z | Undo / redo |
| ⌘C / ⌘X / ⌘V | Copy / cut / paste elements; ⌘V with an image uploads it |
| ⌘A | Select all (not locked or hidden ones) |
| Shift-click | Add an element to the selection, or take it out |
| ⌘G / ⇧⌘G | Group / ungroup the selection |
| ⌘D | Duplicate |
| Delete / Backspace | Delete selection |
| Arrows (⇧ for 10px) | Nudge |
| ⌘] / ⌘[ (⇧ for front/back) | Bring forward / send backward |
| Enter or double-click | Edit selected text |
| Double-click an image | Crop it (Enter keeps the crop, Esc cancels) |
| Enter / Esc while cropping the page | Crop to the box / leave the page as it was |
| ⌘B / ⌘I / ⌘U while typing | Bold, italic or underline the selected words |
| Shift while resizing | Shapes: keep ratio (photos and stickers keep theirs unless Shift is held; photos' side handles crop) |
| ⌘ while dragging | Place freely, without snapping |
| ⌘+ / ⌘− / ⌘0 | Zoom in / out / fit |
| Scroll / pinch (⌘-scroll) | Pan / zoom at pointer |

## How it fits together

- Who may do what is one rule (`lib/auth/access.ts`): a design's owner manages it (rename, delete, visibility, sharing); people it's shared with may open and edit its canvas, public or private; anyone, guests included, may open and edit a public design's canvas; nobody else sees a private one, and every route answers 404 rather than revealing it exists. In SQL it's `visibleTo()` (`lib/db/queries/designs.ts`), which the save and presence statements use too. A share is a row in `design_shares` per email address. Email sign-ups aren't verified, so a matching address alone isn't enough: an account gets in when its email is verified (Google) or once it opens the emailed invite while signed in with that address, which ties the share to it. The link's token proves the inbox is theirs; only its SHA-256 is stored, and sending the invite again replaces it. `getViewer()` (`lib/auth/server.ts`) is how server code learns who is asking (Server Actions that need an account call `requireViewer()`), and every page, Route Handler, and Server Action checks for itself: `proxy.ts` only finishes Google sign-ins and keeps session cookies fresh, and only on the routes that read the session (its middleware sends any path it doesn't know to sign-in, so the landing's pages, crawl files and unknown URLs skip it). The save statement checks access on the design row it locks, so a design made private mid-edit takes no more writes from people who just lost access, and the live page query carries visibility so their editors stop at once.
- `lib/document/` is the versioned, zod-validated design document (elements, background, size) with migrations and factories.
- `lib/editor/` holds the per-editor zustand store, transactional undo history (a drag, slider scrub, or text edit is one step), and transform baking.
- The colour picker (`components/color-popover.tsx`) knows nothing about the editor: it takes a value, an `onChange` and rows of swatches. The editor's wrapper (`components/editor/panels/color-picker.tsx`) makes each open-to-close session one undo step, and fills the rows when it opens: the design's colours from `documentColors()` (`lib/document/palette.ts`, which lists every colour field per element type) and the recent ones this browser keeps in localStorage.
- `components/editor/canvas/` is the Konva workspace. Exports render an offscreen clone of the page at exact size after fonts and images load (`lib/export/`).
- Each element is its own row in `design_elements` with a fractional-index `position` for z-order, so people editing different elements never overwrite each other (`lib/collab/positions.ts`). Edits become per-element change sets (`lib/collab/changeset.ts`); undo replays your own change sets on top of the current document, so it never reverts someone else's work.
- The outbox (`lib/collab/outbox.ts`) sends writes about every 100 ms to `POST /api/designs/[id]/changes`, which applies a batch in one statement and returns its transaction id. Creates upsert, updates only touch rows that still exist (a delete wins over a concurrent edit), and the last write to an element wins.
- Live updates come from three [Neon Realtime](https://neon.com/docs/realtime/overview) live queries per design (page row, element rows, presence rows), sealed on the server (`lib/realtime/server.ts`) and renewed through `POST /api/designs/[id]/live`. The editor shows the server's rows with its own unconfirmed writes on top (`lib/collab/sync-state.ts`) and keeps each write there until its transaction comes back on the live query, so a lagging result after a reconnect can't hide your own edits. If the connection drops for good, a watchdog starts a fresh session.
- Editors stay open across deploys, so a tab can meet what newer code wrote. It keeps the fields it doesn't know on the elements it edits, and leaves out whole elements it can't read (a newer element type) rather than failing: they stay off its canvas and out of a paste, and older server code still opens the design without them (`migrateDocument`). While a design has such elements, the editor says that a reload shows them, and leaves the gallery preview to a tab that can draw them. A tab that's too old to go on stops: when the design's `version` (on the live page query) passes the tab's `DOCUMENT_VERSION`, or a Server Action it calls is gone (their ids change with each deploy, and Next says "Failed to find Server Action"), it sends the edits it has, refuses new ones, leaves presence, and asks for a reload (`components/editor/outdated-dialog.tsx`).
- Cursors, selections, and in-progress drags are rows in `design_presence`, written about 10 times a second while you move (`PUT /api/designs/[id]/presence`, with a heartbeat every 5 s) and read by the presence live query. Positions are in page coordinates, so they line up at any zoom.
- Graphics (icons, emoji and stickers) carry their own art: a viewBox, a palette, and layers of SVG path data whose fill and stroke are palette indexes, so a design never depends on the catalog it came from (copying one into another design, or a later catalog renaming it, changes nothing). `components/editor/canvas/graphic-node.tsx` draws them on one Konva shape with `lib/graphics/draw.ts`, a cached `Path2D` per layer mapped from the viewBox onto the box, so they're vectors at any zoom and in 2× exports; the shape has a fill and a stroke it never paints, so Konva composites it through a buffer while it's see-through and the layers fade as one picture. Clicks hit the whole box. The Graphics tab (`components/editor/panels/graphics-panel.tsx`) fetches the catalog the first time it opens (`lib/graphics/catalog.ts`; never imported, so it's in no bundle): `index.json`, searched in memory by `lib/graphics/search.ts` (exact name, then the name or a word in it starting with the query, then every query word starting a name word or keyword, then anywhere; stickers before emoji before icons), and only the shards holding the results on screen. The files sit under `/graphics/<hash>/`, served with `Cache-Control: immutable` (`next.config.ts`) and outside the proxy. Dragging carries the graphic's own JSON, so the drop needs nothing else.
- Image filters are data on the element (`filter`: a preset id, its intensity, and the slider values), never baked into the file, so they sync, undo, and copy like any other property. A WebGL2 shader (`lib/image-filters/`) draws the photo through them into a canvas that Konva shows instead of the photo; exports share that canvas. Filtered pixels are kept at up to twice the element's page size, which covers retina screens and the 2× export. Browsers without WebGL2 show images unfiltered.
- Photo effects are element data too (`outline`, `glow`, `shadow`: colours and sizes in page px, scaled whenever the photo is, by a corner resize, a page resize or Fill page; a side-handle crop leaves them alone). `lib/photo-effects/` draws them on the filters' WebGL2 context: what the photo shows (its cut-out's transparency through crop, flips, rounded corners or a frame's shape) becomes a mask, a jump flood finds every pixel's nearest point of it for an exact, round outline, and the glow and the shadow blur the photo and outline together. The bitmaps (twice the photo's page size, so retina screens and 2× downloads stay sharp) hang on a Konva shape the size of the photo's box, drawn behind it, so handles, snapping and clicks stay on the box, dragging redraws no bitmap, and exports share them. They're redrawn at most once a frame and only when something they follow changes; a colour, opacity, glow or blur change reuses the photo's distance field, and exports and thumbnails wait for pending redraws. The shadow's offset is applied as it's drawn, turned back by the photo's rotation so it falls the same way on the page, as text shadows do. Without WebGL2 the same effects are drawn on 2D canvases instead (an exact distance transform on the CPU, and canvas shadows for the blurs): slower, but alike.
- The landing page (`app/(marketing)/`) is prerendered and reads no session, so it's the same for everyone; signing in from it lands in the studio (`STUDIO_PATH` in `lib/routes.ts`). It uses the same shadcn theme as the studio, in light and dark: the theme's colour tokens, its fonts (Instrument Sans for text, Figtree for headings) and its components (`Button` through `buttonVariants` on links, `Badge`, plus an `xl` button size for the hero), with only a display type scale (`text-display`, …) and two hero sizes of its own in `app/globals.css`. The hero painting keeps its own height (`h-hero`), so its sun stays at a known place, and the product screenshot sits in the hero just below the sun (`min-h-below-sun`), so the first screen shows the studio. The hero painting and the product screenshot each come in a light and a dark version, picked by the theme class (`components/landing/themed-image.tsx`); the hidden version is fetched once the page is idle, so switching themes doesn't wait on the network. The paintings are watercolors in `components/landing/assets/` (`hero-landscape.webp`, `hero-landscape-dark.webp`), wired up in `components/landing/hero-landscape.tsx`. The logo's orc is painted faintly into them, ears, eyes and tusks, in the sun by day and in the moon at night (that painting is after sunset); a replacement painting needs it painted back in. The features section is a bento grid after React Bits' Magic Bento (`components/landing/magic-bento.tsx`, tiles in `bento-card.tsx`): a small client script writes the pointer's position onto each tile and `app/globals.css` draws the logo's coral from it, an edge light and a spotlight, plus a ring of light on click and a staggered entrance, both off under reduced motion. Its pictures (`components/landing/assets/bento/`) are the studio's own output from one watercolor of an orc painter: the real background removal, thumbnails and filter looks exported with Download, and the layers panel and download settings screenshotted in both themes. Its last tile links to the AI metadata remover. Collaboration has its own section after the grid (`collaboration.tsx`, `#collaboration`), drawn by `collab-mock.tsx`. Each landing page's share image (its `opengraph-image.tsx`) is built at build time by `lib/seo/share-image.tsx`: the day painting with the logo, the page's headline and a line under it in its sky, set in Figtree and Instrument Sans from `assets/fonts/` (OFL) with literal copies of the theme's colours, since the renderer reads no stylesheet. The renderer can't read WebP either, so it draws `assets/hero-landscape-og.jpg`, a 1200×630 crop from the top of `hero-landscape.webp`; recrop it if the painting changes.
- Search: the landing's other pages (`app/(marketing)/`) each aim at what people search for. `/background-remover` runs the editor's own background removal (`lib/background-removal/`) on its own, with nothing uploaded and no account. `/remove-ai-metadata` strips Content Credentials (C2PA), IPTC AI tags, prompts, EXIF and GPS in the browser (`lib/metadata-removal/`): JPG, PNG and WebP are read segment by segment and only what draws the picture is copied, so the pixels and a JPG's quality stay the same; anything else is redrawn on a canvas. `/youtube-thumbnail-preview` is the editor's Preview for any image: the mock (`components/youtube-preview/`) shows it from a blob URL, so it never leaves the device. The maker pages are one template (`app/(marketing)/[slug]/`) over the copy in `lib/seo/size-pages.ts`, built on `SIZE_PRESETS`, so the sizes they quote stay true; their "make one" buttons are plain links to `/new/<preset id>` (`app/new/[preset]/route.ts`), which makes a private design at that size and opens it, after sign-up for guests. `/canva-alternative`, `/remove-bg-alternative` and `/social-media-image-sizes` are written out. Every page sets its canonical URL and carries JSON-LD (`lib/seo/structured-data.ts`, rendered by `components/seo/json-ld.tsx`): the landing an Organization, WebSite and free WebApplication, the others a BreadcrumbList and an FAQPage of the questions they show. The footer links every page and `app/sitemap.ts` lists them, both from `lib/seo/landing-links.ts`; `app/robots.ts` keeps crawlers out of `/api/` and `/new/`, and the studio, editor and auth pages are noindex. Canva's side of the comparisons is dated in their captions: check it when their plans change.
- The logo mark (`components/logo-mark.tsx`) is a pastel sun setting into a lake inside a canvas frame, and the sun is an orc: pointed ears, glaring eyes and two ivory tusks rising out of the horizon. The sun and ears are the theme's `primary` and the eyes `primary-foreground`; the frame, water and tusks are `--logo-*` tokens beside the shadcn ones in `app/globals.css`, and the frame and water turn to dusk under `.dark`: the frame lightens, the water darkens, and the sun stays. The favicon (`app/icon.svg`) is a copy with the frame, horizon and water snapped to whole pixels that follows the browser's light or dark scheme; `app/favicon.ico` and `app/apple-icon.png` are rendered from it and from the mark, and the share image draws the mark inline. The shadcn tokens (the first `:root` and `.dark` blocks in `app/globals.css`) are the one palette for the whole site: the logo's coral sun is the primary in both themes with plum ink on it, over warm paper by day and the dusk sky at night.
- Gallery thumbnails upload to `PUT /api/designs/[id]/thumbnail`, rendered by whichever window made the change.
- The YouTube preview (`components/youtube-preview/`) is plain DOM, with no Konva, so a landing page can use it too. In the editor, `hooks/use-design-preview.ts` draws the design the way Download does, as one small JPEG that every slot shows, and draws it again 300 ms after the last change, a collaborator's included. `components/editor/youtube-preview-context.tsx` shares that one render between the dialog, the corner preview and the badge guide (`youtube-preview-overlays.tsx`), and only makes it while one of them shows; the guide is the mock's own badge, scaled from the smallest thumbnail (Up next) to the page's 16:9 frame on screen. The mock's sizes are constants in `lib/youtube-preview/layout.ts`, dated, since the real site's change, and a frame wider than the window is scaled down with CSS `zoom`; the title, channel, picture (an 88px JPEG cropped in the browser) and length are kept in localStorage (`lib/youtube-preview/details.ts`), never on the server; compares are blob URLs of local files or other designs' gallery previews (`listCompareDesigns` in `lib/actions/preview.ts`, the account's own 30 newest), so they can lag a few seconds behind an edit, and `arrangeFeed` spreads them through the made-up videos; its colours are plain greys in `lib/youtube-preview/theme.ts`, and its top bar has a blank block where a logo would be: no logo, wordmark or play icon, and a note says it isn't affiliated with YouTube.
- Files are served through `/api/storage/*` with immutable caching and random keys, so a storage URL works as a capability: whoever has one can load that image, the way a design's collaborators need to. Thumbnails get a fresh random key on every save, and another when a design goes private.
- Settings (`/settings`) changes the account's name and avatar through Server Actions in `lib/actions/account.ts`. The browser crops an avatar to a 256px JPEG (`lib/upload/prepare-avatar.ts`), stored under `avatars/<user id>/` with a new key each time, and the replaced one is deleted. Neon Auth caches the session in a cookie for five minutes, so each change drops that copy (`forgetCachedSession`) and the new name shows at once.
- A brand kit is rows in `brand_kit_items`, one per colour, font or logo, unique per account, kind and value, so two tabs adding at once can't overwrite each other. Colours are stored as lowercase hex, fonts as catalog ids and logos as the id of one of the account's own ready uploads (deleting the upload takes the logo with it). The Server Actions in `lib/actions/brand-kit.ts` add with one statement that only inserts while the account is under its limit for that kind (the neon-http driver has no interactive transactions) and return the whole kit, so a change shows at once and is then corrected from what's stored (`changeBrandKit`, used by Settings and the editor alike). The editor loads the kit with the design and keeps it in its store; other tabs see a change when they next open a design. Guests have no kit and see none of it.
- Uploads belong to the account that made them and form its library, shared by all of its designs; a design also loads whatever its images show from other people's uploads. Uploading needs edit access to the design it's made from. Files are deduplicated by SHA-256 within one account only, since the hash comes from the browser. Guests' uploads have no owner and stay out of every library.

## License

[MIT](LICENSE)
