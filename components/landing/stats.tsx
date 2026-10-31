import { Container } from "@/components/landing/container";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { FILTER_PRESETS } from "@/lib/image-filters/presets";

// Counted from the editor itself, so the numbers stay true
const STATS = [
  { label: "curated Google Fonts", value: String(FONT_CATALOG.length) },
  {
    label: "one-tap looks, each with an intensity slider",
    value: String(FILTER_PRESETS.length),
  },
  {
    label: "per background removal, because it runs in your browser",
    value: "$0",
  },
];

export const Stats = () => (
  <section aria-label="Orcanva in numbers" className="py-12 md:py-16">
    <Container>
      <dl className="grid gap-12 text-center md:grid-cols-3">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse justify-end gap-3"
          >
            <dt className="text-ash mx-auto max-w-60 text-sm">{stat.label}</dt>
            <dd className="text-heading-lg md:text-display tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </Container>
  </section>
);
