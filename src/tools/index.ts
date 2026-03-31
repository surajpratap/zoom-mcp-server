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
