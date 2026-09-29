import { useMemo, useRef } from 'react';
import type { JobEvidenceSource } from '../platform/workApi';
import { safeResearchUrl } from '../platform/markdown';
import { reportWithoutAppendedSources, researchExcerpt, researchOutline } from '../platform/researchPresentation';
import { ResearchMarkdown } from './ResearchMarkdown';

/** Full research view backed by the same saved Job conversation and owner-scoped evidence endpoint. */
export function ResearchReport({ title, answer, sources, updatedAt }: { title: string; answer: string; sources: JobEvidenceSource[]; updatedAt: Date }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const text = useMemo(() => reportWithoutAppendedSources(answer, sources.length > 0), [answer, sources.length]);
  const sections = useMemo(() => researchOutline(text), [text]);
  const excerpt = useMemo(() => researchExcerpt(text, 520), [text]);
  const navigateTo = (id: string) => {
    const panel = scrollRef.current;
    const heading = panel?.querySelector<HTMLElement>(`#${id}`);
    if (!panel || !heading) return;
    panel.scrollTop += heading.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16;
    heading.focus({ preventScroll: true });
  };
  return (
    <div ref={scrollRef} data-workspace-scroll className="h-full overflow-y-auto px-4 sm:px-6 py-5" aria-label="Full research report">
      <article className="mx-auto max-w-3xl min-w-0 space-y-5">
        <header className="border-b border-border pb-5">
          <div className="flex flex-wrap justify-between gap-2 items-center">
            <span className="text-xs font-medium uppercase tracking-wide text-text-sub">Research report</span>
            <span className="text-xs text-accent">Research complete</span>
          </div>
          <h2 className="text-lg sm:text-xl font-semibold text-text mt-2 break-words">{title}</h2>
          <p className="text-xs text-text-muted mt-2">Saved result · updated {updatedAt.toLocaleString()}</p>
          {excerpt && <div className="mt-4 rounded-lg border border-border bg-panel px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-sub mb-2">At a glance</p>
            <p className="text-sm text-text-sub leading-relaxed break-words">{excerpt}</p>
            <p className="mt-3 text-xs text-text-muted">Excerpt from the saved answer. Check source dates and live protocol data before making decisions.</p>
          </div>}
        </header>
        {sections.length > 0 && <nav aria-label="Report sections" className="rounded-lg border border-border bg-panel p-4">
          <p className="text-xs uppercase font-semibold tracking-wide text-text-sub mb-3">In this report</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => <button key={section.id} type="button" onClick={() => navigateTo(section.id)} className="border border-border rounded px-3 py-2 text-sm text-primary hover:bg-panel-raised focus-visible:outline-2 focus-visible:outline-primary text-left">{section.title}</button>)}
            {sources.length > 0 && <button type="button" onClick={() => navigateTo('research-evidence')} className="border border-border rounded px-3 py-2 text-sm text-primary hover:bg-panel-raised focus-visible:outline-2 focus-visible:outline-primary">Sources & evidence</button>}
          </div>
        </nav>}
        <section aria-label="Complete saved research" className="min-w-0"><ResearchMarkdown text={text} headingIds /></section>
        <section id="research-evidence" tabIndex={-1} aria-label="Sources and evidence" className="border-t border-border pt-5 outline-none">
          <h3 className="text-base font-semibold text-text">Sources & evidence</h3>
          <p className="text-xs text-text-muted mt-1">Provider-returned source references are preserved; their presence does not independently verify every claim.</p>
          {sources.length > 0 ? <ol className="mt-4 space-y-2 list-decimal pl-5 marker:text-text-muted">
            {sources.map((source) => {
              const href = safeResearchUrl(source.url);
              return <li key={source.id} className="pl-1 text-sm min-w-0">
                {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-words focus-visible:outline-2 focus-visible:outline-primary">{source.title || new URL(href).hostname} ↗</a> : <span className="text-text-sub break-words">{source.title || 'Unavailable source'}</span>}
                <span className="block mt-0.5 text-xs text-text-muted break-words">{source.provider}{source.retrievedAt && !Number.isNaN(Date.parse(source.retrievedAt)) ? ` · Retrieved ${new Date(source.retrievedAt).toLocaleString()}` : ''}</span>
              </li>;
            })}
          </ol> : <p className="text-sm text-text-muted mt-3">No structured source records are available. Any links within the saved research remain visible in the report.</p>}
        </section>
      </article>
    </div>
  );
}
