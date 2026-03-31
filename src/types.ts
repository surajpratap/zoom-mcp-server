// Tool definition type for the registry
export interface ToolDef {
  name: string;
  mode: 'read' | 'write';
  description: string;
  schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
  [key: string]: unknown;
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
