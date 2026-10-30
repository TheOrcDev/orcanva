import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";

export default defineConfig({
  env: core.env,
  extends: [core, react, next, shadcn],
  // Agent skills are vendored from upstream and managed by skills-lock.json
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "**/.agents/skills",
    "**/.claude/skills",
  ],
  jsPlugins: shadcn.jsPlugins,
});
