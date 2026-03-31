# @kindflow/zoom-mcp-server

MCP server that gives [Claude Code](https://docs.anthropic.com/en/docs/claude-code) native tool access to the Zoom API. Supports meetings, transcripts, users, and team chat.

## Features

- **Meeting Transcripts** — Fetch and parse cloud recording transcripts into clean, readable text
- **Meetings** — List, create, update, and delete meetings; view past meeting participants
- **Users** — List and inspect account users
- **Team Chat** — List channels, read messages, and send messages
- **Read-Only Mode** — Safe by default; write tools only available when explicitly enabled

## Prerequisites

You need a **Zoom Server-to-Server OAuth app**. Create one at [marketplace.zoom.us](https://marketplace.zoom.us/):

1. Go to **Develop** > **Build App** > **Server-to-Server OAuth**
2. Add the required scopes for the APIs you want to use:
   - `cloud_recording:read:admin` — for transcripts and recordings
   - `meeting:read:admin`, `meeting:write:admin` — for meetings
   - `user:read:admin` — for users
   - `chat_message:read:admin`, `chat_message:write:admin` — for team chat
   - `chat_channel:read:admin` — for listing channels
3. Note your **Account ID**, **Client ID**, and **Client Secret**

## Setup with Claude Code

### Quick setup (CLI)

```bash
claude mcp add zoom -- npx @kindflow/zoom-mcp-server
```

Then set your environment variables in `~/.claude/settings.json` under the `zoom` server entry.

### Manual setup

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "zoom": {
      "command": "npx",
      "args": ["@kindflow/zoom-mcp-server"],
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

Set `ZOOM_MODE` to `readwrite` to enable creating meetings, sending chat messages, etc.

## Available Tools

### Transcripts (Read)
| Tool | Description |
|------|-------------|
| `zoom_list_recordings` | List cloud recordings for a user within a date range |
| `zoom_get_meeting_transcript` | Download and parse a meeting transcript into clean text |
| `zoom_get_meeting_summary` | Get AI-generated meeting summary (requires Zoom AI Companion) |

### Meetings (Read)
| Tool | Description |
|------|-------------|
| `zoom_list_meetings` | List scheduled, live, upcoming, or previous meetings |
| `zoom_get_meeting` | Get meeting details including settings and join URL |
| `zoom_list_past_meeting_participants` | List who attended a past meeting |

### Meetings (Write — requires `readwrite` mode)
| Tool | Description |
|------|-------------|
| `zoom_create_meeting` | Create a new meeting |
| `zoom_update_meeting` | Update an existing meeting |
| `zoom_delete_meeting` | Delete a meeting |

### Users (Read)
| Tool | Description |
|------|-------------|
| `zoom_list_users` | List all users in the account |
| `zoom_get_user` | Get a specific user's details |

### Team Chat (Read)
| Tool | Description |
|------|-------------|
| `zoom_list_channels` | List chat channels |
| `zoom_list_chat_messages` | List messages in a channel |

### Team Chat (Write — requires `readwrite` mode)
| Tool | Description |
|------|-------------|
| `zoom_send_chat_message` | Send a message to a channel or user |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZOOM_ACCOUNT_ID` | Yes | Zoom Server-to-Server OAuth account ID |
| `ZOOM_CLIENT_ID` | Yes | Zoom app client ID |
| `ZOOM_CLIENT_SECRET` | Yes | Zoom app client secret |
| `ZOOM_MODE` | No | `readonly` (default) or `readwrite` |

## Troubleshooting

**`sh: zoom-mcp-server: command not found` when using npx**

This happens with `asdf` version manager. Use one of these alternatives:

Install globally, then reference directly:
```bash
npm install -g @kindflow/zoom-mcp-server
```

```json
{
  "zoom": {
    "command": "zoom-mcp-server",
    "env": { ... }
  }
}
```

Or point to the installed file with node:
```json
{
  "zoom": {
    "command": "node",
    "args": ["node_modules/@kindflow/zoom-mcp-server/dist/index.js"],
    "env": { ... }
  }
}
```

## Development

```bash
git clone https://github.com/surajpratap/zoom-mcp-server.git
cd zoom-mcp-server
npm install
npm test         # Run tests
npm run build    # Compile TypeScript
npm run dev      # Run with tsx (no build needed)
```

## License

MIT
