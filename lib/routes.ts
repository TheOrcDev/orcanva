// Where the gallery of designs lives; `/` is the landing page
export const STUDIO_PATH = "/studio";

// Marketing pages are always light, whatever theme the studio uses
export const isMarketingPath = (pathname: string): boolean => pathname === "/";
