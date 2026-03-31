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
