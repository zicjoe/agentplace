import { ResearchMarkdown } from './ResearchMarkdown';
import { conversationResearchLayout } from '../platform/conversationResearchLayout';

/** Saved research is presented answer-first, without extra model calls.
 * The original full text, coverage and sources remain available in-place;
 * Job execution evidence remains independently inspectable. */
export function ConversationResearchAnswer({
  text,
  title,
  complete,
  onViewWork,
}: {
  text: string;
  title: string;
  complete: boolean;
  onViewWork: () => void;
}) {
  const layout = conversationResearchLayout(text);
  const hasTakeaway = !!layout.takeaway;
  const hasDetailDisclosure = hasTakeaway && layout.analysis.length > 1100;
  return (
    <section className="conversation-research-answer min-w-0" aria-label={`Research answer: ${title}`}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={complete ? 'text-accent' : 'text-text-sub'}>
          {complete ? 'Research complete' : 'Research report available'}
        </span>
        <span className="text-text-muted" aria-hidden="true">·</span>
        <button
          type="button"
          onClick={onViewWork}
          className="text-primary hover:text-primary-hover hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-primary rounded"
          aria-label={`View work, sources and Worker participation for ${title}`}
        >
          View work and evidence →
        </button>
      </div>
      {hasTakeaway ? <ResearchMarkdown text={layout.takeaway} /> : null}
      {hasDetailDisclosure ? (
        <details className="mt-4 border-t border-border-dim pt-3">
          <summary className="cursor-pointer text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded w-fit">Read full analysis</summary>
          <div className="mt-3"><ResearchMarkdown text={layout.analysis} /></div>
        </details>
      ) : layout.analysis ? <div className={hasTakeaway ? 'mt-4' : ''}><ResearchMarkdown text={layout.analysis} /></div> : null}
      {/* Keep a literal full-report rendering path for research without a structured takeaway. */}
      {!hasTakeaway && !layout.analysis && <ResearchMarkdown text={text} />}
      {layout.coverage && (
        <details className="mt-4 border-t border-border-dim pt-3">
          <summary className="cursor-pointer text-sm text-text-sub hover:text-text focus-visible:outline-2 focus-visible:outline-primary rounded w-fit">Verification coverage · Detailed checks</summary>
          <div className="mt-3"><ResearchMarkdown text={layout.coverage} /></div>
        </details>
      )}
      {layout.sources && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded w-fit">Sources and references</summary>
          <div className="mt-3"><ResearchMarkdown text={layout.sources} /></div>
        </details>
      )}
      {layout.incomplete && (
        <p role="status" className="mt-3 text-xs leading-relaxed text-warn">
          Part of this report may end mid-sentence. Review the full Job evidence before relying on the unfinished point.
        </p>
      )}
    </section>
  );
}
