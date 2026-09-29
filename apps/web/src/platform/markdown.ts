/** Small, intentionally restricted Markdown grammar for untrusted model output.
 * The rendering layer creates React elements, never HTML strings. */
export type MarkdownBlock =
  | { type: 'paragraph' | 'heading' | 'quote'; text: string; level?: number }
  | { type: 'list'; ordered: boolean; start: number; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][]; align: Array<'left' | 'center' | 'right'> }
  | { type: 'code'; code: string; language: string }
  | { type: 'rule' };

export function safeResearchUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

function cells(line: string): string[] {
  // Ignore escaped pipes when locating table column boundaries.
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.slice(0, -1);
  return value.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}
function separator(line: string): boolean {
  return cells(line).length > 0 && cells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
}
function isStructural(line: string): boolean {
  const value = line.trim();
  return /^#{1,6}\s/.test(value) || /^>\s?/.test(value) || /^([-*+]\s+|\d+[.)]\s+)/.test(value)
    || /^(```|~~~)/.test(value) || /^([-*_]\s*){3,}$/.test(value);
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const value = line.trim();
    if (!value) { i++; continue; }
    const fence = /^\s*(```|~~~)([^\s`]*)/.exec(line);
    if (fence) {
      const marker = fence[1] ?? '```';
      const language = (fence[2] ?? '').slice(0, 32);
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').trim().startsWith(marker)) body.push(lines[i++] ?? '');
      if (i < lines.length) i++;
      blocks.push({ type: 'code', language, code: body.join('\n') });
      continue;
    }
    if (/^([-*_]\s*){3,}$/.test(value)) { blocks.push({ type: 'rule' }); i++; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(value);
    if (heading) { blocks.push({ type: 'heading', level: (heading[1] ?? '').length, text: heading[2] ?? '' }); i++; continue; }
    if (i + 1 < lines.length && line.includes('|') && separator(lines[i + 1] ?? '')) {
      const headers = cells(line);
      const separators = cells(lines[i + 1] ?? '');
      if (headers.length === separators.length) {
        const align: Array<'left' | 'center' | 'right'> = separators.map((cell) => cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : 'left');
        const rows: string[][] = [];
        i += 2;
        while (i < lines.length && (lines[i] ?? '').trim() && (lines[i] ?? '').includes('|')) {
          const row = cells(lines[i] ?? '');
          rows.push(headers.map((_, index) => row[index] ?? ''));
          i++;
        }
        blocks.push({ type: 'table', headers, align, rows });
        continue;
      }
    }
    const listMatch = /^(\d+)[.)]\s+(.+)$|^[-*+]\s+(.+)$/.exec(value);
    if (listMatch) {
      const ordered = !!listMatch[1];
      const start = ordered ? Number(listMatch[1]) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? '').trim();
        const match = ordered ? /^\d+[.)]\s+(.+)$/.exec(current) : /^[-*+]\s+(.+)$/.exec(current);
        if (!match) break;
        items.push(match[1] ?? ''); i++;
      }
      blocks.push({ type: 'list', ordered, start, items });
      continue;
    }
    if (/^>\s?/.test(value)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test((lines[i] ?? '').trim())) quote.push((lines[i++] ?? '').trim().replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: quote.join(' ') });
      continue;
    }
    const paragraph: string[] = [value]; i++;
    while (i < lines.length && (lines[i] ?? '').trim() && !isStructural(lines[i] ?? '') && !(i + 1 < lines.length && (lines[i] ?? '').includes('|') && separator(lines[i + 1] ?? ''))) {
      paragraph.push((lines[i++] ?? '').trim());
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }
  return blocks;
}
