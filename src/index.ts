#!/usr/bin/env node
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
