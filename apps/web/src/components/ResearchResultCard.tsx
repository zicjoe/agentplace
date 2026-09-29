import { useMemo, useState } from 'react';
import { researchExcerpt, researchOutline } from '../platform/researchPresentation';
import { ResearchMarkdown } from './ResearchMarkdown';

/** Reuses the saved message body; expanding never creates another report, message or Job. */
export function ResearchResultCard({ text, title, onOpenReport }: { text: string; title: string; onOpenReport?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const excerpt = useMemo(() => researchExcerpt(text), [text]);
  const outline = useMemo(() => researchOutline(text), [text]);
  return (
    <section className="rounded-lg border border-border bg-panel min-w-0 max-w-2xl" aria-label={`Research result: ${title}`}>
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] font-medium tracking-wide uppercase text-text-sub">Research result</span>
          <span className="text-xs font-medium text-accent">Research complete</span>
        </div>
        <h3 className="text-base text-text font-semibold mt-2 break-words">{title}</h3>
        {excerpt ? <p className="mt-2 text-sm leading-relaxed text-text-sub break-words">{excerpt}</p> : <p className="mt-2 text-sm text-text-muted">The complete saved research is available below.</p>}
        {outline.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Report sections">
          {outline.slice(0, 4).map((section) => <span key={section.id} className="rounded border border-border-dim bg-panel-raised px-2 py-1 text-xs text-text-sub">{section.title}</span>)}
          {outline.length > 4 && <span className="text-xs text-text-muted self-center">+{outline.length - 4} sections</span>}
        </div>}
        <div className="flex items-center flex-wrap gap-2 mt-4">
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="text-sm font-medium text-primary border border-primary/30 rounded px-3 py-2 hover:bg-primary-dim/20 focus-visible:outline-2 focus-visible:outline-primary">
            {expanded ? 'Collapse report ↑' : 'Read inline ↓'}
          </button>
          {onOpenReport && <button type="button" onClick={onOpenReport} className="text-sm font-medium text-primary rounded px-3 py-2 hover:bg-primary-dim/20 focus-visible:outline-2 focus-visible:outline-primary">Open full report →</button>}
        </div>
      </div>
      {expanded && <div className="border-t border-border px-4 py-4 sm:px-5"><ResearchMarkdown text={text} /></div>}
    </section>
  );
}
