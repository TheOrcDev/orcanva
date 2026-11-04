const TRAILING_SLASHES = /\/+$/u;

// Production's address, which canonical URLs, the sitemap, structured data,
// share images and links in emails resolve against. A self-hosted copy sets
// SITE_URL: prerendered pages read it at build, emails when they're sent.
export const SITE_URL = (
  process.env.SITE_URL || "https://www.orcanva.app"
).replace(TRAILING_SLASHES, "");

export const SITE_NAME = "Orcanva";

// Orcanva's source, MIT-licensed
export const GITHUB_URL = "https://github.com/TheOrcDev/orcanva";
