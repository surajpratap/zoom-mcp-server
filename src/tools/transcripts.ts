import { z } from 'zod';
import { ZoomClient } from '../zoom-client.js';
import { parseVtt } from '../vtt-parser.js';
import type { ToolResult, ZoomRecordingFile } from '../types.js';

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
        const meetingId = args.meetingId as string;

        // Strategy 1: Get recording files and look for TRANSCRIPT file type
        const data = await client.request<{
          recording_files: ZoomRecordingFile[];
          topic: string;
        }>(`/meetings/${meetingId}/recordings`, {
          params: { include_fields: 'download_access_token' },
        });

        const transcriptFile = data.recording_files?.find(
          (f) => f.file_type === 'TRANSCRIPT' || f.recording_type === 'audio_transcript',
        );

        if (transcriptFile) {
          const vttContent = await client.fetchRaw(transcriptFile.download_url);
          const parsed = parseVtt(vttContent);
          return {
            content: [{ type: 'text', text: `# Transcript: ${data.topic}\n\n${parsed}` }],
          };
        }

        // Strategy 2: Try the AI Companion transcript endpoint
        // GET /meetings/{uuid}/transcript returns JSON with a download_url for the VTT file
        try {
          const transcriptMeta = await client.request<{
            download_url: string;
            can_download: boolean;
            meeting_topic: string;
          }>(`/meetings/${meetingId}/transcript`);

          if (transcriptMeta.download_url) {
            const vttContent = await client.fetchRaw(transcriptMeta.download_url);
            const parsed = parseVtt(vttContent);
            return {
              content: [{ type: 'text', text: `# Transcript: ${data.topic}\n\n${parsed}` }],
            };
          }
        } catch {
          // Strategy 2 failed, continue
        }

        // Strategy 4: Fall back to meeting summary content if available
        try {
          const summary = await client.request<{
            summary_content: string;
            summary_title: string;
          }>(`/meetings/${meetingId}/meeting_summary`);

          if (summary.summary_content) {
            return {
              content: [{
                type: 'text',
                text: `# ${summary.summary_title}\n\nNote: Full VTT transcript not available via API. Returning AI-generated meeting summary instead.\n\n${summary.summary_content}`,
              }],
            };
          }
        } catch {
          // No summary either
        }

        return {
          content: [{ type: 'text', text: `No transcript found for meeting ${meetingId}. The recording files exist but no transcript file (VTT) was found. Check that audio transcription is enabled in Zoom Settings > Recording > Audio transcript.` }],
          isError: true,
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
