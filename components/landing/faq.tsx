import type { FaqEntry } from "@/lib/seo/structured-data";

// A page's questions and answers, all open: the same entries go into its
// structured data, which has to match what the page shows
export const Faq = ({ entries }: { entries: readonly FaqEntry[] }) => (
  <section aria-labelledby="faq-heading" className="flex flex-col gap-10">
    <h2
      id="faq-heading"
      className="font-heading text-heading md:text-heading-lg font-normal"
    >
      Questions
    </h2>
    <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
      {entries.map(({ answer, question }) => (
        <div key={question} className="flex flex-col gap-2">
          <dt className="font-medium">{question}</dt>
          <dd className="text-muted-foreground text-pretty">{answer}</dd>
        </div>
      ))}
    </dl>
  </section>
);
