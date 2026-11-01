// Structured data (schema.org JSON-LD) that search engines and AI answers
// read beside the page. `<` is escaped, so no string in it can end the tag.
export const JsonLd = ({ data }: { data: object }) => (
  <script
    type="application/ld+json"
    // oxlint-disable-next-line react/no-danger -- JSON only, escaped above
    dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replaceAll("<", String.raw`<`),
    }}
  />
);
