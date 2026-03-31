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
