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
