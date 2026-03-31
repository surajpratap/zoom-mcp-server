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
