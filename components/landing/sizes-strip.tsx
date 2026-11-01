import { Container } from "@/components/landing/container";
import { SIZE_PRESETS } from "@/lib/document/presets";

type PresetId = (typeof SIZE_PRESETS)[number]["id"];

const SHOWN: ReadonlySet<PresetId> = new Set<PresetId>([
  "youtube-thumbnail",
  "story",
  "square",
  "x-post",
  "open-graph",
  "4k",
]);

// Read from the editor's own presets, so the strip never goes out of date
const sizes = SIZE_PRESETS.filter((preset) => SHOWN.has(preset.id));

export const SizesStrip = () => (
  <section aria-labelledby="sizes-heading" className="py-16">
    <Container className="flex flex-col items-center gap-8">
      <h2 id="sizes-heading" className="text-ink-muted text-sm">
        Every size, exact to the pixel
      </h2>
      <ul className="grid grid-cols-2 gap-x-12 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
        {sizes.map((preset) => (
          <li key={preset.id} className="flex flex-col items-center gap-1">
            <span className="text-ink-soft">{preset.label}</span>
            <span className="text-ink-muted text-sm tabular-nums">
              {preset.width} × {preset.height}
            </span>
          </li>
        ))}
      </ul>
    </Container>
  </section>
);
