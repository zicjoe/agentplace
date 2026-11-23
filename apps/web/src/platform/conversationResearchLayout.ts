/**
 * Project an immutable saved report into a readable conversation without
 * generating or changing financial/research facts. The full report remains
 * reachable even when a detailed section is collapsed.
 */
export interface ConversationResearchLayout {
  takeaway: string;
  analysis: string;
  coverage: string;
  sources: string;
  incomplete: boolean;
}

function removeSection(text: string, heading: RegExp, stopOnAnyHeading = false): { without: string; section: string } {
  const lines = text.split('\n');
  const begin = lines.findIndex((line) => heading.test(line.trim()));
  if (begin < 0) return { without: text, section: '' };
  const level = (lines[begin]!.match(/^\s*(#+)\s/)?.[1] ?? '').length;
  let end = lines.length;
  for (let i = begin + 1; i < lines.length; i++) {
    const next = lines[i]!.trim().match(/^(#{1,6})\s+(.+)$/);
    if (next && (stopOnAnyHeading || next[1]!.length <= level)) { end = i; break; }
  }
  const section = lines.slice(begin, end).join('\n').trim();
  return { without: [...lines.slice(0, begin), ...lines.slice(end)].join('\n').trim(), section };
}

/** Some specialist reports put every finding beneath a single "Bottom line"
 * heading. Keep the actual first paragraph in the conversation and move the
 * remaining original paragraphs to the disclosure; never summarize or delete
 * content. For short conclusions, retain the entire original section. */
function limitLongTakeaway(takeaway: string, analysis: string): { takeaway: string; analysis: string } {
  if (takeaway.length <= 1100) return { takeaway, analysis };
  const firstLineEnd = takeaway.indexOf('\n');
  if (firstLineEnd < 0 || !/^#{1,3}\s/.test(takeaway)) return { takeaway, analysis };
  const heading = takeaway.slice(0, firstLineEnd).trim();
  const body = takeaway.slice(firstLineEnd + 1).trim();
  const firstParagraphEnd = body.search(/\n\s*\n/);
  if (firstParagraphEnd < 0 || firstParagraphEnd > 900) return { takeaway, analysis };
  const lead = body.slice(0, firstParagraphEnd).trim();
  const remaining = body.slice(firstParagraphEnd).trim();
  if (!lead || !remaining) return { takeaway, analysis };
  return {
    takeaway: `${heading}\n\n${lead}`,
    analysis: [remaining, analysis].filter(Boolean).join('\n\n').trim(),
  };
}

/** Full-sentence leading conclusion detection is conservative: never infer or
 * reword market facts from arbitrary detail paragraphs. */
function liftConclusion(text: string): { takeaway: string; analysis: string } {
  const sections = [/^#{1,3}\s+(?:bottom line|key takeaway|summary|conclusion|assessment)(?:\s*[:—–-].*)?\s*$/i];
  for (const pattern of sections) {
    const result = removeSection(text, pattern, true);
    if (result.section) return limitLongTakeaway(result.section, result.without);
  }
  const paragraphs = text.split(/\n\s*\n/);
  const index = paragraphs.findIndex((part) => /^\*\*(?:conclusion|bottom line|my assessment|key takeaway)\b/i.test(part.trim()));
  if (index >= 0) {
    return { takeaway: paragraphs[index]!, analysis: paragraphs.filter((_, position) => position !== index).join('\n\n').trim() };
  }
  // The model did not provide a safe, identifiable conclusion. Preserve the
  // complete answer in-line rather than synthesizing a misleading one.
  return { takeaway: '', analysis: text };
}

/** A lightweight warning, not a claim that a model response was definitely
 * truncated. Provider finish reasons are separately checked in the backend. */
export function mayEndMidSentence(answer: string): boolean {
  const withoutSources = removeSection(answer.trim(), /^#{1,3}\s+Sources\s*$/i).without.trim();
  const lastParagraph = withoutSources.split(/\n\s*\n/).at(-1)?.trim() ?? '';
  if (!lastParagraph || lastParagraph.startsWith('|') || lastParagraph.startsWith('#')) return false;
  if (/[.!?…][)\]"'*_`]*$/.test(lastParagraph)) return false;
  if (/^[-*+]\s/.test(lastParagraph) || /^\d+[.)]\s/.test(lastParagraph)) return false;
  return lastParagraph.length >= 35 && /\b(?:a|an|the|for|of|to|from|with|by|in)\s+[\w-]+(?:\s+[\w-]+){0,3}\s*$/i.test(lastParagraph);
}

export function conversationResearchLayout(answer: string): ConversationResearchLayout {
  const sources = removeSection(answer.trim(), /^#{1,3}\s+Sources\s*$/i);
  const coverage = removeSection(sources.without, /^#{1,3}\s+Coverage\s*$/i, true);
  const conclusion = liftConclusion(coverage.without);
  return {
    takeaway: conclusion.takeaway,
    analysis: conclusion.analysis,
    coverage: coverage.section,
    sources: sources.section,
    incomplete: mayEndMidSentence(coverage.without),
  };
}
