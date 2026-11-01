import { SITE_NAME, SITE_URL } from "@/lib/site";

// schema.org JSON-LD for the landing's pages, shown by components/seo/json-ld

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

const absolute = (path: string) => new URL(path, SITE_URL).href;

export interface FaqEntry {
  answer: string;
  question: string;
}

interface Application {
  description: string;
  features: string[];
  name: string;
  path: string;
}

// Free, in the browser, on any system
const webApplication = ({
  description,
  features,
  name,
  path,
}: Application) => ({
  "@type": "WebApplication",
  applicationCategory: "DesignApplication",
  browserRequirements: "A recent browser with JavaScript",
  description,
  featureList: features,
  name,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  operatingSystem: "Any",
  publisher: { "@id": ORGANIZATION_ID },
  url: absolute(path),
});

// The landing: who makes Orcanva, the site, and the app itself
export const homeStructuredData = (
  app: Omit<Application, "name" | "path">
) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": ORGANIZATION_ID,
      "@type": "Organization",
      logo: absolute("/apple-icon.png"),
      name: SITE_NAME,
      url: absolute("/"),
    },
    {
      "@type": "WebSite",
      name: SITE_NAME,
      publisher: { "@id": ORGANIZATION_ID },
      url: absolute("/"),
    },
    webApplication({ ...app, name: SITE_NAME, path: "/" }),
  ],
});

// A page beside the landing: where it sits, its questions and answers (the
// same ones the page shows), and the tool it is, if it's one
export const pageStructuredData = ({
  application,
  faq,
  name,
  path,
}: {
  application?: Omit<Application, "path">;
  faq: FaqEntry[];
  name: string;
  path: string;
}) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          item: absolute("/"),
          name: SITE_NAME,
          position: 1,
        },
        { "@type": "ListItem", item: absolute(path), name, position: 2 },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map(({ answer, question }) => ({
        "@type": "Question",
        acceptedAnswer: { "@type": "Answer", text: answer },
        name: question,
      })),
    },
    ...(application ? [webApplication({ ...application, path })] : []),
  ],
});
