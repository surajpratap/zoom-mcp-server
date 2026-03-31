# Zoom MCP Server

MCP server providing Claude Code with native access to Zoom APIs.

## Build & Test

```bash
npm run build    # Compile TypeScript to dist/
npm test         # Run all tests
npm run dev      # Run directly with tsx (development)
```

## Environment Variables

- `ZOOM_ACCOUNT_ID` — Zoom Server-to-Server OAuth account ID
- `ZOOM_CLIENT_ID` — Zoom app client ID
- `ZOOM_CLIENT_SECRET` — Zoom app client secret
- `ZOOM_MODE` — `readonly` (default) or `readwrite`

## Adding to Claude Code

Add to `~/.claude/settings.json` under `mcpServers`:

```json
{
  "zoom": {
    "command": "node",
    "args": ["/Users/surajpratap/projects/zoom_client/dist/index.js"],
    "env": {
      "ZOOM_ACCOUNT_ID": "...",
      "ZOOM_CLIENT_ID": "...",
      "ZOOM_CLIENT_SECRET": "...",
      "ZOOM_MODE": "readonly"
    }
  }
}
```
