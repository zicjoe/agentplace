import { ResearchMarkdown } from './ResearchMarkdown';

/** A saved, source-grounded research result is the answer in Manager chat.
 * Its Job and execution evidence remain independently inspectable; this component
 * never generates a new report, Job, provider claim, or verification status. */
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
      <ResearchMarkdown text={text} />
    </section>
  );
}
