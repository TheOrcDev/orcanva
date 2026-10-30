import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Agent skills are vendored from upstream and managed by skills-lock.json
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/.agents/skills",
    "**/.claude/skills",
    // drizzle-kit regenerates migration metadata on every `db:generate`
    "drizzle/meta",
  ],
});
