// Template files are served from public/template-files, outside the proxy,
// with immutable caching (next.config.ts): their names come from their
// content, so a changed file is a new URL
export const TEMPLATE_FILES_PATH = "/template-files";

export const templatePreviewUrl = (file: string): string =>
  `${TEMPLATE_FILES_PATH}/previews/${file}`;
