// /design/<id>?comment=<thread id> opens the design with that thread open
// (mention emails link to it). A reply's id opens its thread too.
export const COMMENT_PARAM = "comment";

export const commentPath = (designId: string, threadId: string): string =>
  `/design/${designId}?${COMMENT_PARAM}=${threadId}`;
