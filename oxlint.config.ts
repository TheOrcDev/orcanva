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
  overrides: [
    {
      // shadcn CLI owns components/ui: keep formatting and correctness rules,
      // but accept its upstream style so `shadcn add` stays drop-in
      files: ["**/components/ui/**"],
      rules: {
        eqeqeq: "off",
        "func-style": "off",
        "jsx-a11y/click-events-have-key-events": "off",
        "jsx-a11y/label-has-associated-control": "off",
        "jsx-a11y/no-noninteractive-element-interactions": "off",
        "jsx-a11y/prefer-tag-over-role": "off",
        "no-nested-ternary": "off",
        "no-use-before-define": "off",
        "react/function-component-definition": "off",
        "react/jsx-no-constructed-context-values": "off",
        "react/no-object-type-as-default-prop": "off",
        "react/todo": "off",
      },
    },
    {
      // next/og renders share images without a stylesheet: inline styles and
      // literal colours are the only way to style them, and a plain <img> the
      // only way to draw a picture
      files: ["**/opengraph-image.tsx", "**/twitter-image.tsx"],
      rules: {
        "nextjs/no-img-element": "off",
        "shadcn/no-inline-styles": "off",
        "shadcn/no-raw-colors": "off",
      },
    },
  ],
});
