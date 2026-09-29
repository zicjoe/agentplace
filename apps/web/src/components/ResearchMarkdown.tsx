import type { ReactNode } from 'react';
import { parseMarkdown, safeResearchUrl } from '../platform/markdown';
import { displayInlineMarkdown } from '../platform/researchPresentation';

/** Inline Markdown is emitted as React text/elements. No HTML parser or dangerouslySetInnerHTML. */
function inline(text: string, prefix = ''): ReactNode[] {
  text = displayInlineMarkdown(text);
  const parts: ReactNode[] = [];
  // Images are deliberately not expanded; model output cannot embed remote trackers.
  const token = /(?<!!)\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])|https?:\/\/[^\s<>]+/g;
  let cursor = 0; let match: RegExpExecArray | null; let key = 0;
  while ((match = token.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const raw = match[0]; const id = `${prefix}-${key++}`;
    if (match[1] !== undefined) {
      const href = safeResearchUrl(match[2] ?? '');
      parts.push(href ? <a key={id} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary-hover break-words">{match[1]}</a> : raw);
    } else if (match[3] !== undefined || match[4] !== undefined) {
      parts.push(<strong key={id} className="font-semibold text-text">{inline(match[3] ?? match[4] ?? '', id)}</strong>);
    } else if (match[5] !== undefined) {
      parts.push(<code key={id} className="text-xs bg-panel-raised rounded px-1 py-0.5 break-words">{match[5]}</code>);
    } else if (match[6] !== undefined || match[7] !== undefined) {
      parts.push(<em key={id}>{inline(match[6] ?? match[7] ?? '', id)}</em>);
    } else {
      const trimmed = raw.replace(/[.,;:!?)\]]+$/, '');
      const href = safeResearchUrl(trimmed);
      parts.push(href ? <a key={id} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary-hover break-all">{trimmed}</a> : raw);
      if (trimmed !== raw) parts.push(raw.slice(trimmed.length));
    }
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export function ResearchMarkdown({ text, headingIds = false }: { text: string; headingIds?: boolean }) {
  return (
    <div className="research-markdown min-w-0 max-w-full space-y-3 text-sm leading-relaxed text-text-sub">
      {parseMarkdown(text).map((block, index) => {
        const key = `${index}-${block.type}`;
        switch (block.type) {
          case 'heading': return <h3 key={key} id={headingIds ? `research-section-${index}` : undefined} tabIndex={headingIds ? -1 : undefined} className={`font-semibold text-text ${block.level === 1 ? 'text-base pt-1' : 'text-sm pt-1'}`}>{inline(block.text, key)}</h3>;
          case 'paragraph': return <p key={key} className="break-words">{inline(block.text, key)}</p>;
          case 'quote': return <blockquote key={key} className="border-l-2 border-primary/40 pl-3 text-text-muted">{inline(block.text, key)}</blockquote>;
          case 'list': return block.ordered
            ? <ol key={key} start={block.start} className="list-decimal pl-5 space-y-1">{block.items.map((item, i) => <li key={i} className="pl-1 break-words">{inline(item, `${key}-${i}`)}</li>)}</ol>
            : <ul key={key} className="list-disc pl-5 space-y-1">{block.items.map((item, i) => <li key={i} className="pl-1 break-words">{inline(item, `${key}-${i}`)}</li>)}</ul>;
          case 'table': return <div key={key} className="max-w-full overflow-x-auto rounded-lg border border-border" role="region" aria-label="Research comparison table" tabIndex={0}><table className="w-full min-w-max border-collapse text-xs"><thead className="bg-panel-raised"><tr>{block.headers.map((cell, i) => <th key={i} scope="col" className="border-b border-border px-3 py-2 text-left font-semibold text-text whitespace-normal min-w-28" style={{textAlign:block.align[i]}}>{inline(cell, `${key}-h${i}`)}</th>)}</tr></thead><tbody>{block.rows.map((row, r) => <tr key={r} className="border-b border-border-dim last:border-b-0">{row.map((cell, c) => <td key={c} className="px-3 py-2 align-top whitespace-normal min-w-28 max-w-72 break-words" style={{textAlign:block.align[c]}}>{inline(cell, `${key}-${r}-${c}`)}</td>)}</tr>)}</tbody></table></div>;
          case 'code': return <pre key={key} className="max-w-full overflow-x-auto bg-panel-raised border border-border rounded-lg p-3 text-xs"><code>{block.code}</code></pre>;
          case 'rule': return <hr key={key} className="border-border" />;
        }
      })}
    </div>
  );
}
