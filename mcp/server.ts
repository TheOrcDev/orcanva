// Orcanva's MCP server: lets a local agent (Claude Code, Cursor, …) make and
// edit designs by talking to it. Runs over stdio from this checkout, with
// the app's own .env.local, as the account named by ORCANVA_EMAIL. Edits
// land through the editor's save statement, so an open editor shows them
// live.
//
// Usage: pnpm mcp   (see mcp/README.md for wiring it into an agent)
import path from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";

import { createServer } from "./tools";

config({
  path: path.resolve(import.meta.dirname, "../.env.local"),
  quiet: true,
});

await createServer().connect(new StdioServerTransport());
