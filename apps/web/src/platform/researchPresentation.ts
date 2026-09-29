import { parseMarkdown } from './markdown.ts';

/** Presentation-only projections of an immutable research answer. No new model claims. */
export function researchExcerpt(answer: string, maxLength = 310): string {
  const blocks = parseMarkdown(answer);
  const paragraph = blocks.find((block) => block.type === 'paragraph' &&
    !/^\*\*[^*]+\*\*$/.test(block.text.trim()) &&
    block.text.replace(/[*_`]/g, '').trim().length > 45 &&
    !/^sources\s*:?$/i.test(block.text.trim()));
  const source = paragraph?.type === 'paragraph' ? paragraph.text : '';
  const plain = source.replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLength) return plain;
  const beforeLimit = plain.slice(0, maxLength);
  const sentenceEnd = Math.max(beforeLimit.lastIndexOf('. '), beforeLimit.lastIndexOf('? '), beforeLimit.lastIndexOf('! '));
  const cut = sentenceEnd > maxLength * 0.5 ? sentenceEnd + 1 : beforeLimit.lastIndexOf(' ');
  return `${plain.slice(0, cut > 0 ? cut : maxLength).trimEnd()}…`;
}

/** Hide the duplicate appended source list only when structured, persisted evidence is available. */
export function reportWithoutAppendedSources(answer: string, hasEvidence: boolean): string {
  if (!hasEvidence) return answer;
  const sourceHeading = /^#{1,6}\s+Sources\s*$/gim;
  const candidates = [...answer.matchAll(sourceHeading)];
  const last = candidates.at(-1);
  if (!last || last.index === undefined) return answer;
  const suffix = answer.slice(last.index + last[0].length).trim();
  const lines = suffix.split('\n').map((line) => line.trim()).filter(Boolean);
  // The Worker appends an ordered list of provider URLs. Do not hide a model-written
  // Sources section containing commentary, findings, or anything else.
  if (!lines.length || !lines.every((line) => /^\d+[.)]\s+.+https?:\/\/\S+/.test(line))) return answer;
  return answer.slice(0, last.index).trimEnd();
}

export function researchOutline(answer: string): Array<{ id: string; title: string; level: number }> {
  return parseMarkdown(answer).flatMap((block, index) => block.type === 'heading' && !/^sources\s*$/i.test(block.text.trim())
    ? [{ id: `research-section-${index}`, title: block.text.replace(/\*\*|__/g, ''), level: block.level ?? 2 }]
    : []);
}

/** Leave the original stored response intact; remove one clearly unmatched leading emphasis marker in display only. */
export function displayInlineMarkdown(value: string): string {
  const positions = [...value.matchAll(/\*\*/g)].map((match) => match.index ?? -1);
  if (positions.length % 2 === 0 || positions.length === 0) return value;
  // A solitary trailing opener (e.g. "identifies **DAI, EURS") is display noise.
  // Preserve earlier balanced pairs and never change the persisted message.
  const position = positions[positions.length - 1]!;
  return value.slice(0, position) + value.slice(position + 2);
}
