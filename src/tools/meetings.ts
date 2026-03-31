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
