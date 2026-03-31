# Zoom MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server that gives Claude Code native tool access to Zoom APIs (transcripts, meetings, users, team chat) with a read-only mode default.

**Architecture:** A single TypeScript MCP server using `@modelcontextprotocol/sdk` with Server-to-Server OAuth. Each Zoom API endpoint is a discrete MCP tool. Tools are organized by domain in `src/tools/`. A `ZOOM_MODE` env var controls whether write tools are registered.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `zod`, Node.js native `fetch`, `vitest` for testing

---

## File Structure

| File | Responsibility |
|------|----------------|
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config targeting ES2022+ with Node module resolution |
| `.env.example` | Template for required env vars |
| `src/index.ts` | MCP server entry point — creates server, connects stdio transport |
| `src/auth.ts` | S2S OAuth token management — fetch, cache, auto-refresh |
| `src/zoom-client.ts` | Base HTTP client — attaches bearer token, handles errors, retries on 401 |
| `src/vtt-parser.ts` | Parses VTT transcript files into clean `[timestamp] Speaker: text` format |
| `src/tools/index.ts` | Tool registry — registers all tools with mode filtering |
| `src/tools/transcripts.ts` | Transcript tools: list_recordings, get_transcript, get_summary |
| `src/tools/meetings.ts` | Meeting tools: list, get, participants, create, update, delete |
| `src/tools/users.ts` | User tools: list, get |
| `src/tools/chat.ts` | Chat tools: list_channels, list_messages, send_message |
| `src/types.ts` | Shared TypeScript types for Zoom API responses |
| `tests/vtt-parser.test.ts` | Unit tests for VTT parser |
| `tests/auth.test.ts` | Unit tests for auth token management |
| `tests/tool-registry.test.ts` | Unit tests for mode filtering logic |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/surajpratap/projects/zoom_client
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @modelcontextprotocol/sdk zod
npm install -D typescript vitest tsx @types/node
```

- [ ] **Step 3: Update package.json scripts and type**

Edit `package.json` to set:

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create .env.example**

Write `.env.example`:

```
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_MODE=readonly
```

- [ ] **Step 6: Create .gitignore**

Write `.gitignore`:

```
node_modules/
dist/
.env
```

- [ ] **Step 7: Create src and tests directories**

```bash
mkdir -p src/tools tests
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json .env.example .gitignore
git commit -m "feat: scaffold project with dependencies and config"
```

---

### Task 2: VTT Parser (TDD)

**Files:**
- Create: `tests/vtt-parser.test.ts`
- Create: `src/vtt-parser.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/vtt-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseVtt } from '../src/vtt-parser.js';

describe('parseVtt', () => {
  it('parses a standard VTT transcript with speakers', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
John Doe: Hello everyone, welcome to the meeting.

2
00:00:05.000 --> 00:00:10.000
Jane Smith: Thanks John, let's get started.

3
00:00:10.000 --> 00:00:15.000
John Doe: First item on the agenda is the Q4 review.
`;

    const result = parseVtt(vtt);
    expect(result).toBe(
      '[00:00:00] John Doe: Hello everyone, welcome to the meeting.\n' +
      '[00:00:05] Jane Smith: Thanks John, let\'s get started.\n' +
      '[00:00:10] John Doe: First item on the agenda is the Q4 review.'
    );
  });

  it('handles VTT without speaker names', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
Hello everyone.

2
00:00:05.000 --> 00:00:10.000
Let's begin.
`;

    const result = parseVtt(vtt);
    expect(result).toBe(
      '[00:00:00] Hello everyone.\n' +
      '[00:00:05] Let\'s begin.'
    );
  });

  it('returns empty string for empty or header-only VTT', () => {
    expect(parseVtt('WEBVTT\n\n')).toBe('');
    expect(parseVtt('')).toBe('');
  });

  it('handles multi-line cues', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
John Doe: This is a long sentence
that spans multiple lines.
`;

    const result = parseVtt(vtt);
    expect(result).toBe('[00:00:00] John Doe: This is a long sentence that spans multiple lines.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/vtt-parser.test.ts
```

Expected: FAIL — cannot find module `../src/vtt-parser.js`

- [ ] **Step 3: Write minimal implementation**

Write `src/vtt-parser.ts`:

```typescript
export function parseVtt(vtt: string): string {
  if (!vtt.trim()) return '';

  const lines = vtt.split('\n');
  const cues: string[] = [];
  let i = 0;

  // Skip WEBVTT header and any metadata
  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];

    if (line.includes('-->')) {
      // Extract start timestamp (HH:MM:SS from HH:MM:SS.mmm)
      const timestamp = line.split('-->')[0].trim().split('.')[0];
      // Trim to MM:SS if hours are 00, otherwise keep HH:MM:SS
      const parts = timestamp.split(':');
      const display = parts.length === 3
        ? `${parts[0]}:${parts[1]}:${parts[2]}`
        : timestamp;

      // Collect all text lines for this cue
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        // Skip numeric cue identifiers
        if (/^\d+$/.test(lines[i].trim())) {
          i++;
          continue;
        }
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        const text = textLines.join(' ');
        cues.push(`[${display}] ${text}`);
      }
    } else {
      i++;
    }
  }

  return cues.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/vtt-parser.test.ts
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/vtt-parser.ts tests/vtt-parser.test.ts
git commit -m "feat: add VTT transcript parser with tests"
```

---

### Task 3: Auth Module (TDD)

**Files:**
- Create: `tests/auth.test.ts`
- Create: `src/auth.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoomAuth } from '../src/auth.js';

describe('ZoomAuth', () => {
  const mockCredentials = {
    accountId: 'test-account',
    clientId: 'test-client',
    clientSecret: 'test-secret',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches a new token on first call', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'test-token-123',
        expires_in: 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    const token = await auth.getToken();

    expect(token).toBe('test-token-123');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://zoom.us/oauth/token');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    // Check Basic auth header
    const expectedBasic = Buffer.from('test-client:test-secret').toString('base64');
    expect(options.headers['Authorization']).toBe(`Basic ${expectedBasic}`);
  });

  it('returns cached token on subsequent calls', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'cached-token',
        expires_in: 3600,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    await auth.getToken();
    const token2 = await auth.getToken();

    expect(token2).toBe('cached-token');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch
  });

  it('refreshes token when expired', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'old-token',
          expires_in: 0, // Expires immediately
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    await auth.getToken();
    const token2 = await auth.getToken();

    expect(token2).toBe('new-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on auth failure', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid credentials',
    });
    vi.stubGlobal('fetch', mockFetch);

    const auth = new ZoomAuth(mockCredentials);
    await expect(auth.getToken()).rejects.toThrow('Zoom auth failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/auth.test.ts
```

Expected: FAIL — cannot find module `../src/auth.js`

- [ ] **Step 3: Write minimal implementation**

Write `src/auth.ts`:

```typescript
export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export class ZoomAuth {
  private credentials: ZoomCredentials;
  private token: string | null = null;
  private expiresAt: number = 0;

  constructor(credentials: ZoomCredentials) {
    this.credentials = credentials;
  }

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt) {
      return this.token;
    }
    return this.refresh();
  }

  async refresh(): Promise<string> {
    const { accountId, clientId, clientSecret } = this.credentials;
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Zoom auth failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    // Expire 60 seconds early to avoid edge cases
    this.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.token!;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/auth.test.ts
```

Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/auth.ts tests/auth.test.ts
git commit -m "feat: add Zoom S2S OAuth auth module with tests"
```

---

### Task 4: Zoom HTTP Client

**Files:**
- Create: `src/zoom-client.ts`

- [ ] **Step 1: Write the Zoom HTTP client**

Write `src/zoom-client.ts`:

```typescript
import { ZoomAuth } from './auth.js';

export interface ZoomRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
}

export class ZoomClient {
  private auth: ZoomAuth;
  private baseUrl = 'https://api.zoom.us/v2';

  constructor(auth: ZoomAuth) {
    this.auth = auth;
  }

  async request<T = unknown>(path: string, options: ZoomRequestOptions = {}): Promise<T> {
    const { method = 'GET', params, body } = options;

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          search.set(key, String(value));
        }
      }
      const qs = search.toString();
      if (qs) url += `?${qs}`;
    }

    const response = await this.fetchWithAuth(url, method, body);

    // Handle 401 — refresh token and retry once
    if (response.status === 401) {
      await this.auth.refresh();
      const retry = await this.fetchWithAuth(url, method, body);
      return this.handleResponse<T>(retry);
    }

    return this.handleResponse<T>(response);
  }

  async fetchRaw(url: string): Promise<string> {
    const token = await this.auth.getToken();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      await this.auth.refresh();
      const token2 = await this.auth.getToken();
      const retry = await fetch(url, {
        headers: { Authorization: `Bearer ${token2}` },
      });
      if (!retry.ok) {
        throw new Error(`Zoom API error (${retry.status}): ${await retry.text()}`);
      }
      return retry.text();
    }

    if (!response.ok) {
      throw new Error(`Zoom API error (${response.status}): ${await response.text()}`);
    }
    return response.text();
  }

  private async fetchWithAuth(
    url: string,
    method: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const token = await this.auth.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    const init: RequestInit = { method, headers };

    if (body) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    return fetch(url, init);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return {} as T;
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || 'unknown';
      throw new Error(`Zoom API rate limited. Retry after ${retryAfter} seconds.`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Zoom API error (${response.status}): ${text}`);
    }

    return response.json() as Promise<T>;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/zoom-client.ts
git commit -m "feat: add Zoom HTTP client with auth and error handling"
```

---

### Task 5: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write shared types**

Write `src/types.ts`:

```typescript
// Tool definition type for the registry
export interface ToolDef {
  name: string;
  mode: 'read' | 'write';
  description: string;
  schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

// Zoom API response types
export interface ZoomPaginatedResponse<T> {
  page_size: number;
  total_records: number;
  next_page_token: string;
  [key: string]: unknown;
}

export interface ZoomMeeting {
  uuid: string;
  id: number;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  timezone: string;
  created_at: string;
  join_url: string;
  agenda?: string;
}

export interface ZoomRecording {
  uuid: string;
  id: number;
  topic: string;
  start_time: string;
  duration: number;
  recording_count: number;
  recording_files: ZoomRecordingFile[];
}

export interface ZoomRecordingFile {
  id: string;
  recording_type: string;
  file_type: string;
  file_extension?: string;
  download_url: string;
  status: string;
  recording_start: string;
  recording_end: string;
}

export interface ZoomUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  type: number;
  role_id: string;
  dept: string;
  timezone: string;
  created_at: string;
  last_login_time: string;
  status: string;
}

export interface ZoomChannel {
  id: string;
  name: string;
  type: number;
}

export interface ZoomChatMessage {
  id: string;
  message: string;
  sender: string;
  date_time: string;
  timestamp: number;
}

export interface ZoomParticipant {
  id: string;
  user_id: string;
  name: string;
  email: string;
  join_time: string;
  leave_time: string;
  duration: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared Zoom API types"
```

---

### Task 6: Transcript Tools (Highest Priority)

**Files:**
- Create: `src/tools/transcripts.ts`

- [ ] **Step 1: Write transcript tools**

Write `src/tools/transcripts.ts`:

```typescript
import { z } from 'zod';
import { ZoomClient } from '../zoom-client.js';
import { parseVtt } from '../vtt-parser.js';
import type { ToolResult, ZoomRecording, ZoomRecordingFile } from '../types.js';

export function createTranscriptTools(client: ZoomClient) {
  return [
    {
      name: 'zoom_list_recordings',
      mode: 'read' as const,
      description:
        'List cloud recordings for a Zoom user within a date range. Returns meeting topics, dates, and recording IDs needed to fetch transcripts.',
      schema: {
        userId: z.string().describe('Zoom user ID or email address'),
        from: z.string().optional().describe('Start date in YYYY-MM-DD format'),
        to: z.string().optional().describe('End date in YYYY-MM-DD format'),
        page_size: z.number().optional().describe('Number of records per page (max 300)'),
        next_page_token: z.string().optional().describe('Token for next page of results'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request(`/users/${args.userId}/recordings`, {
          params: {
            from: args.from as string | undefined,
            to: args.to as string | undefined,
            page_size: args.page_size as number | undefined,
            next_page_token: args.next_page_token as string | undefined,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_get_meeting_transcript',
      mode: 'read' as const,
      description:
        'Download and parse the transcript for a specific meeting recording. Returns clean text with timestamps and speaker names. Use zoom_list_recordings first to find the meeting ID.',
      schema: {
        meetingId: z.string().describe('The meeting ID or UUID (use double-encoded UUID if it starts with / or contains //)'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        // Get recording files for this meeting
        const data = await client.request<{
          recording_files: ZoomRecordingFile[];
          topic: string;
        }>(`/meetings/${args.meetingId}/recordings`);

        // Find the transcript file (VTT)
        const transcriptFile = data.recording_files?.find(
          (f) => f.file_type === 'TRANSCRIPT' || f.recording_type === 'audio_transcript',
        );

        if (!transcriptFile) {
          return {
            content: [{ type: 'text', text: `No transcript found for meeting ${args.meetingId}. The meeting may not have cloud recording or transcription enabled.` }],
            isError: true,
          };
        }

        // Download and parse the VTT file
        const vttContent = await client.fetchRaw(transcriptFile.download_url);
        const parsed = parseVtt(vttContent);

        return {
          content: [{ type: 'text', text: `# Transcript: ${data.topic}\n\n${parsed}` }],
        };
      },
    },
    {
      name: 'zoom_get_meeting_summary',
      mode: 'read' as const,
      description:
        'Get the AI-generated meeting summary for a specific meeting. Requires Zoom AI Companion to be enabled on the account. Returns error if unavailable.',
      schema: {
        meetingId: z.string().describe('The meeting ID or UUID'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        try {
          const data = await client.request<Record<string, unknown>>(
            `/meetings/${args.meetingId}/meeting_summary`,
          );
          return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('404')) {
            return {
              content: [{ type: 'text', text: `No meeting summary found for meeting ${args.meetingId}. AI Companion may not be enabled or the meeting may not have a summary.` }],
              isError: true,
            };
          }
          throw error;
        }
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/transcripts.ts
git commit -m "feat: add transcript tools (list recordings, get transcript, get summary)"
```

---

### Task 7: Meeting Tools

**Files:**
- Create: `src/tools/meetings.ts`

- [ ] **Step 1: Write meeting tools**

Write `src/tools/meetings.ts`:

```typescript
import { z } from 'zod';
import { ZoomClient } from '../zoom-client.js';
import type { ToolResult } from '../types.js';

export function createMeetingTools(client: ZoomClient) {
  return [
    {
      name: 'zoom_list_meetings',
      mode: 'read' as const,
      description:
        'List meetings for a Zoom user. Can filter by type: scheduled, live, upcoming, or previous.',
      schema: {
        userId: z.string().describe('Zoom user ID or email address'),
        type: z
          .enum(['scheduled', 'live', 'upcoming', 'previous'])
          .optional()
          .describe('Meeting type filter (default: scheduled)'),
        page_size: z.number().optional().describe('Number of records per page (max 300)'),
        next_page_token: z.string().optional().describe('Token for next page of results'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request(`/users/${args.userId}/meetings`, {
          params: {
            type: args.type as string | undefined,
            page_size: args.page_size as number | undefined,
            next_page_token: args.next_page_token as string | undefined,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_get_meeting',
      mode: 'read' as const,
      description:
        'Get detailed information about a specific meeting including settings, join URL, and agenda.',
      schema: {
        meetingId: z.string().describe('The meeting ID or UUID'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request(`/meetings/${args.meetingId}`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_list_past_meeting_participants',
      mode: 'read' as const,
      description:
        'List participants of a past meeting. Shows who attended, join/leave times, and duration.',
      schema: {
        meetingId: z.string().describe('The meeting UUID (double-encode if starts with / or contains //)'),
        page_size: z.number().optional().describe('Number of records per page (max 300)'),
        next_page_token: z.string().optional().describe('Token for next page of results'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request(`/past_meetings/${args.meetingId}/participants`, {
          params: {
            page_size: args.page_size as number | undefined,
            next_page_token: args.next_page_token as string | undefined,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_create_meeting',
      mode: 'write' as const,
      description:
        'Create a new Zoom meeting for a user. Returns the join URL and meeting details.',
      schema: {
        userId: z.string().describe('Zoom user ID or email address'),
        topic: z.string().describe('Meeting topic/title'),
        type: z
          .number()
          .optional()
          .describe('Meeting type: 1=instant, 2=scheduled (default: 2)'),
        start_time: z.string().optional().describe('Meeting start time in ISO 8601 format (e.g. 2024-01-15T14:00:00Z)'),
        duration: z.number().optional().describe('Meeting duration in minutes (default: 60)'),
        timezone: z.string().optional().describe('Timezone (e.g. America/New_York)'),
        agenda: z.string().optional().describe('Meeting description/agenda'),
        password: z.string().optional().describe('Meeting password'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const { userId, ...body } = args;
        const data = await client.request(`/users/${userId}/meetings`, {
          method: 'POST',
          body: body as Record<string, unknown>,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_update_meeting',
      mode: 'write' as const,
      description:
        'Update an existing Zoom meeting. Only include the fields you want to change.',
      schema: {
        meetingId: z.string().describe('The meeting ID'),
        topic: z.string().optional().describe('New meeting topic'),
        start_time: z.string().optional().describe('New start time in ISO 8601 format'),
        duration: z.number().optional().describe('New duration in minutes'),
        timezone: z.string().optional().describe('New timezone'),
        agenda: z.string().optional().describe('New agenda/description'),
        password: z.string().optional().describe('New meeting password'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const { meetingId, ...body } = args;
        await client.request(`/meetings/${meetingId}`, {
          method: 'PATCH',
          body: body as Record<string, unknown>,
        });
        return { content: [{ type: 'text', text: `Meeting ${meetingId} updated successfully.` }] };
      },
    },
    {
      name: 'zoom_delete_meeting',
      mode: 'write' as const,
      description:
        'Delete a Zoom meeting. This action cannot be undone.',
      schema: {
        meetingId: z.string().describe('The meeting ID to delete'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        await client.request(`/meetings/${args.meetingId}`, { method: 'DELETE' });
        return { content: [{ type: 'text', text: `Meeting ${args.meetingId} deleted successfully.` }] };
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/meetings.ts
git commit -m "feat: add meeting tools (list, get, participants, create, update, delete)"
```

---

### Task 8: User Tools

**Files:**
- Create: `src/tools/users.ts`

- [ ] **Step 1: Write user tools**

Write `src/tools/users.ts`:

```typescript
import { z } from 'zod';
import { ZoomClient } from '../zoom-client.js';
import type { ToolResult } from '../types.js';

export function createUserTools(client: ZoomClient) {
  return [
    {
      name: 'zoom_list_users',
      mode: 'read' as const,
      description:
        'List all users in the Zoom account. Can filter by status (active, inactive, pending).',
      schema: {
        status: z
          .enum(['active', 'inactive', 'pending'])
          .optional()
          .describe('Filter by user status (default: active)'),
        page_size: z.number().optional().describe('Number of records per page (max 300)'),
        next_page_token: z.string().optional().describe('Token for next page of results'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request('/users', {
          params: {
            status: args.status as string | undefined,
            page_size: args.page_size as number | undefined,
            next_page_token: args.next_page_token as string | undefined,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_get_user',
      mode: 'read' as const,
      description:
        'Get detailed information about a specific Zoom user including email, role, timezone, and department.',
      schema: {
        userId: z.string().describe('Zoom user ID or email address'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request(`/users/${args.userId}`);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/users.ts
git commit -m "feat: add user tools (list, get)"
```

---

### Task 9: Chat Tools

**Files:**
- Create: `src/tools/chat.ts`

- [ ] **Step 1: Write chat tools**

Write `src/tools/chat.ts`:

```typescript
import { z } from 'zod';
import { ZoomClient } from '../zoom-client.js';
import type { ToolResult } from '../types.js';

export function createChatTools(client: ZoomClient) {
  return [
    {
      name: 'zoom_list_channels',
      mode: 'read' as const,
      description:
        'List Zoom Team Chat channels for a user.',
      schema: {
        userId: z.string().describe('Zoom user ID or email address'),
        page_size: z.number().optional().describe('Number of records per page (max 300)'),
        next_page_token: z.string().optional().describe('Token for next page of results'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request(`/chat/users/${args.userId}/channels`, {
          params: {
            page_size: args.page_size as number | undefined,
            next_page_token: args.next_page_token as string | undefined,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_list_chat_messages',
      mode: 'read' as const,
      description:
        'List messages in a Zoom Team Chat channel. Returns message content, sender, and timestamps.',
      schema: {
        userId: z.string().describe('Zoom user ID or email address'),
        to_channel: z.string().describe('Channel ID to list messages from'),
        from: z.string().optional().describe('Start date in YYYY-MM-DD format'),
        to: z.string().optional().describe('End date in YYYY-MM-DD format'),
        page_size: z.number().optional().describe('Number of records per page (max 50)'),
        next_page_token: z.string().optional().describe('Token for next page of results'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const data = await client.request(`/chat/users/${args.userId}/messages`, {
          params: {
            to_channel: args.to_channel as string,
            from: args.from as string | undefined,
            to: args.to as string | undefined,
            page_size: args.page_size as number | undefined,
            next_page_token: args.next_page_token as string | undefined,
          },
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
    {
      name: 'zoom_send_chat_message',
      mode: 'write' as const,
      description:
        'Send a message in Zoom Team Chat to a channel or direct to a user.',
      schema: {
        userId: z.string().describe('Zoom user ID or email address (the sender)'),
        message: z.string().describe('The message text to send'),
        to_channel: z.string().optional().describe('Channel ID to send message to (provide this OR to_contact, not both)'),
        to_contact: z.string().optional().describe('User email to send direct message to (provide this OR to_channel, not both)'),
      },
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const body: Record<string, unknown> = { message: args.message };
        if (args.to_channel) body.to_channel = args.to_channel;
        if (args.to_contact) body.to_contact = args.to_contact;

        const data = await client.request(`/chat/users/${args.userId}/messages`, {
          method: 'POST',
          body,
        });
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      },
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tools/chat.ts
git commit -m "feat: add chat tools (list channels, list messages, send message)"
```

---

### Task 10: Tool Registry with Mode Filtering (TDD)

**Files:**
- Create: `tests/tool-registry.test.ts`
- Create: `src/tools/index.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/tool-registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterToolsByMode } from '../src/tools/index.js';

const mockTools = [
  { name: 'zoom_list_users', mode: 'read' as const, description: '', schema: {}, handler: async () => ({ content: [{ type: 'text' as const, text: '' }] }) },
  { name: 'zoom_get_user', mode: 'read' as const, description: '', schema: {}, handler: async () => ({ content: [{ type: 'text' as const, text: '' }] }) },
  { name: 'zoom_create_meeting', mode: 'write' as const, description: '', schema: {}, handler: async () => ({ content: [{ type: 'text' as const, text: '' }] }) },
  { name: 'zoom_delete_meeting', mode: 'write' as const, description: '', schema: {}, handler: async () => ({ content: [{ type: 'text' as const, text: '' }] }) },
];

describe('filterToolsByMode', () => {
  it('returns only read tools in readonly mode', () => {
    const result = filterToolsByMode(mockTools, 'readonly');
    expect(result.map((t) => t.name)).toEqual(['zoom_list_users', 'zoom_get_user']);
  });

  it('returns all tools in readwrite mode', () => {
    const result = filterToolsByMode(mockTools, 'readwrite');
    expect(result.map((t) => t.name)).toEqual([
      'zoom_list_users',
      'zoom_get_user',
      'zoom_create_meeting',
      'zoom_delete_meeting',
    ]);
  });

  it('defaults to readonly when mode is undefined', () => {
    const result = filterToolsByMode(mockTools, undefined);
    expect(result.map((t) => t.name)).toEqual(['zoom_list_users', 'zoom_get_user']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tool-registry.test.ts
```

Expected: FAIL — cannot find module

- [ ] **Step 3: Write the tool registry**

Write `src/tools/index.ts`:

```typescript
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ZoomClient } from '../zoom-client.js';
import { createTranscriptTools } from './transcripts.js';
import { createMeetingTools } from './meetings.js';
import { createUserTools } from './users.js';
import { createChatTools } from './chat.js';
import type { ToolDef } from '../types.js';

export function filterToolsByMode(
  tools: ToolDef[],
  mode: string | undefined,
): ToolDef[] {
  const effectiveMode = mode === 'readwrite' ? 'readwrite' : 'readonly';
  if (effectiveMode === 'readwrite') return tools;
  return tools.filter((t) => t.mode === 'read');
}

export function registerTools(server: McpServer, client: ZoomClient, mode: string | undefined): void {
  const allTools = [
    ...createTranscriptTools(client),
    ...createMeetingTools(client),
    ...createUserTools(client),
    ...createChatTools(client),
  ];

  const tools = filterToolsByMode(allTools, mode);

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      async (args) => tool.handler(args as Record<string, unknown>),
    );
  }

  const modeLabel = mode === 'readwrite' ? 'readwrite' : 'readonly';
  console.error(`Registered ${tools.length} tools (mode: ${modeLabel})`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/tool-registry.test.ts
```

Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/index.ts tests/tool-registry.test.ts
git commit -m "feat: add tool registry with read-only mode filtering"
```

---

### Task 11: MCP Server Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write the MCP server entry point**

Write `src/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZoomAuth } from './auth.js';
import { ZoomClient } from './zoom-client.js';
import { registerTools } from './tools/index.js';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const accountId = getRequiredEnv('ZOOM_ACCOUNT_ID');
  const clientId = getRequiredEnv('ZOOM_CLIENT_ID');
  const clientSecret = getRequiredEnv('ZOOM_CLIENT_SECRET');
  const mode = process.env.ZOOM_MODE;

  const auth = new ZoomAuth({ accountId, clientId, clientSecret });
  const client = new ZoomClient(auth);

  const server = new McpServer({
    name: 'zoom',
    version: '1.0.0',
  });

  registerTools(server, client, mode);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Zoom MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add MCP server entry point with stdio transport"
```

---

### Task 12: Build, Test & Verify

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass (VTT parser: 4, Auth: 4, Tool registry: 3)

- [ ] **Step 2: Build the project**

```bash
npm run build
```

Expected: TypeScript compiles to `dist/` with no errors

- [ ] **Step 3: Verify the built server starts**

```bash
echo '{}' | ZOOM_ACCOUNT_ID=test ZOOM_CLIENT_ID=test ZOOM_CLIENT_SECRET=test node dist/index.js &
sleep 1
kill %1 2>/dev/null
```

Expected: Server starts and prints "Zoom MCP server running on stdio" to stderr

- [ ] **Step 4: Fix any build or runtime errors found in steps 1-3**

If any issues, fix the source files and re-run build + tests.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build/test issues"
```

(Skip if no fixes needed)

---

### Task 13: Claude Code Integration Setup

- [ ] **Step 1: Create a CLAUDE.md for the project**

Write `CLAUDE.md` in the project root:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with build, test, and integration instructions"
```
