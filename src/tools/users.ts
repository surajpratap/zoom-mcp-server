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
