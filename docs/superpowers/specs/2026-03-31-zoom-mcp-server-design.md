# Zoom MCP Server — Design Spec

## Overview

An MCP (Model Context Protocol) server that gives Claude Code native tool access to the Zoom API. Built with TypeScript/Node.js using Server-to-Server OAuth authentication.

## Goals

1. **Meeting transcripts** (highest priority) — fetch and parse cloud recording transcripts so Claude can analyze meeting content
2. **Meetings** — create, list, manage meetings
3. **Users** — list and inspect account users
4. **Team Chat** — read and send messages in channels

## Architecture

### Approach: Flat Tool MCP Server

A single MCP server with each Zoom API endpoint exposed as a discrete tool. Simple flat structure, one `src/tools/` directory organized by domain.

### Project Structure

```
zoom_client/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── auth.ts               # S2S OAuth token management
│   ├── zoom-client.ts        # Base HTTP client for Zoom API
│   ├── tools/
│   │   ├── index.ts          # Tool registry — registers all tools
│   │   ├── transcripts.ts    # Transcript tools
│   │   ├── meetings.ts       # Meeting CRUD tools
│   │   ├── users.ts          # User tools
│   │   └── chat.ts           # Team Chat tools
│   └── types.ts              # Zoom API type definitions
```

## Authentication

- **Method:** Server-to-Server OAuth (client credentials grant)
- **Credentials via env vars:** `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`
- **Token endpoint:** `https://zoom.us/oauth/token`
- **Token lifetime:** 1 hour, cached in memory, auto-refreshed when expired
- **All API calls** go through `zoom-client.ts` which attaches the bearer token automatically
- **On 401 response:** refresh token once and retry the request

## Read-Only Mode

- **Env var:** `ZOOM_MODE` — values: `readonly` (default) or `readwrite`
- **Mechanism:** Write tools are not registered with the MCP server when in `readonly` mode — they don't exist, not just blocked
- **Default is `readonly`** — safe behavior if the variable is unset

## Tools

### Transcripts (highest priority)

| Tool | Type | Description |
|------|------|-------------|
| `zoom_list_recordings` | read | List cloud recordings for a user within a date range |
| `zoom_get_meeting_transcript` | read | Download and parse the VTT transcript for a specific meeting/recording into clean text (speaker + timestamp + text) |
| `zoom_get_meeting_summary` | read | Get AI-generated meeting summary (requires Zoom AI Companion enabled on the account; returns error if unavailable) |

### Meetings

| Tool | Type | Description |
|------|------|-------------|
| `zoom_list_meetings` | read | List upcoming/scheduled meetings for a user |
| `zoom_get_meeting` | read | Get details of a specific meeting |
| `zoom_list_past_meeting_participants` | read | List participants of a past meeting |
| `zoom_create_meeting` | write | Create a new meeting |
| `zoom_update_meeting` | write | Update an existing meeting |
| `zoom_delete_meeting` | write | Delete a meeting |

### Users

| Tool | Type | Description |
|------|------|-------------|
| `zoom_list_users` | read | List all users in the account |
| `zoom_get_user` | read | Get a specific user's details |

### Team Chat

| Tool | Type | Description |
|------|------|-------------|
| `zoom_list_channels` | read | List chat channels |
| `zoom_list_chat_messages` | read | List messages in a channel |
| `zoom_send_chat_message` | write | Send a message to a channel or user |

**Total: 14 tools** (11 read, 3 write)

## Implementation Details

### Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `zod` — Input validation and schema definitions (required by MCP SDK)
- Node.js native `fetch` — no HTTP library needed

### Transcript Handling

- Zoom stores transcripts as `.vtt` files in cloud recordings
- `zoom_get_meeting_transcript` fetches the VTT file and parses it into clean text format: `[timestamp] Speaker: text`
- Full transcript text returned — Claude's context window handles it

### Pagination

- Zoom API uses cursor-based pagination (`next_page_token`)
- List tools accept an optional `next_page_token` parameter
- Response includes `next_page_token` if more results exist

### Error Handling

- Zoom API errors returned as structured MCP tool error responses with clear messages
- 401 → transparent token refresh + single retry
- 429 (rate limit) → error message includes retry-after value
- 404 → clear "not found" message

### Build & Run

- TypeScript compiled to `dist/` via `tsc`
- `npm run build` to compile
- `npm run dev` for development using `tsx`

## Claude Code Integration

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "zoom": {
      "command": "node",
      "args": ["/Users/surajpratap/projects/zoom_client/dist/index.js"],
      "env": {
        "ZOOM_ACCOUNT_ID": "your-account-id",
        "ZOOM_CLIENT_ID": "your-client-id",
        "ZOOM_CLIENT_SECRET": "your-client-secret",
        "ZOOM_MODE": "readonly"
      }
    }
  }
}
```
