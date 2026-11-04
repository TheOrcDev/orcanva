# Orcanva MCP server

Lets a local AI agent (Claude Code, Cursor, Codex, Claude Desktop, or anything else that speaks [MCP](https://modelcontextprotocol.io)) make and edit Orcanva designs from a plain request:

> Make me a YouTube thumbnail for my video "I tried 30 days of cold showers": dark blue gradient, huge white text with a black outline on the left, a fire emoji, and my photo at ~/Pictures/me.png on the right.

The agent creates the design in your account and hands you its link. If the design is open in a browser, you watch the elements appear live, because edits go through the same save path as the editor's.

## Setup

It runs from this checkout and uses the app's own `.env.local` (database and storage), so follow [DEVELOPMENT.md](../DEVELOPMENT.md) first and make sure `pnpm dev` works. Then sign up in the app with the account the agent should act as.

| Variable |  |
| --- | --- |
| `ORCANVA_EMAIL` | Required. The account the agent acts as. Its designs are the ones it can see and edit. |
| `ORCANVA_URL` | Where links point. Default `http://localhost:3000`. |

### Claude Code

```bash
claude mcp add orcanva --scope user \
  -e ORCANVA_EMAIL=you@example.com \
  -- pnpm --silent --dir /absolute/path/to/orcanva mcp
```

The repo doesn't register it in a `.mcp.json`, so agents working on Orcanva's code don't get tools that write to your database unless you add them.

### Other agents (Cursor, Claude Desktop, …)

Add a stdio server with this config:

```json
{
  "mcpServers": {
    "orcanva": {
      "command": "pnpm",
      "args": ["--silent", "--dir", "/absolute/path/to/orcanva", "mcp"],
      "env": { "ORCANVA_EMAIL": "you@example.com" }
    }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `list_sizes` / `list_fonts` / `list_templates` | What's available: size presets, the 40 fonts, starter templates |
| `search_graphics` | Search the icons, emoji and stickers |
| `list_designs` | Your designs and ones shared with you |
| `create_design` | New private design: a preset size or custom size, blank or from a template, optional background |
| `get_design` | Size, link, pages and every element's fields (bottom to top) |
| `add_elements` | Add text, `rect`, `ellipse`, `line`, `arrow`, `graphic` (icon/emoji/sticker by id or keywords) and `image` (local path or URL). Place them with `x`/`y`, or with `place: "top-left"`, `"center"` and so on. |
| `update_elements` | Change any fields (`text`, `fill`, `fontSize`, `x`, …) and/or bring to front or send to back |
| `delete_elements` | Remove elements |
| `set_background` | Solid colour or gradient for a page |
| `add_page` | Another page, for carousels |
| `rename_design` | Rename |
| `get_preview` | The picture an open editor last rendered, so the agent can see its work |

Every write is checked by the editor's own document schema. A bad value, an unknown font or a misspelt field comes back to the agent as an error it can fix, and never reaches your design. Edits also land in version history, so you can always roll back.

## Limits

- It talks to the database directly, so it works with an Orcanva you run yourself, not with orcanva.app. Hosted use would need API tokens in the app.
- Text height is estimated until an editor measures it. `get_preview` shows what an open editor last rendered, which can lag a few seconds behind the agent's edits.
- AI tools like background removal and upscaling run in the browser, so they aren't available here yet.
