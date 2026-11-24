import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  WORKER_CREATION_STARTERS,
  workerCreationBrief,
  type WorkerCreationPath,
} from '../platform/workerCreationStart';

type Choice = { id: WorkerCreationPath; title: string; description: string };

const PATHS: readonly Choice[] = [
  { id: 'describe', title: 'Describe a job', description: 'Tell AgentPlace what you want done.' },
  { id: 'template', title: 'Start with a template', description: 'Choose a starting point, then edit it.' },
  { id: 'expertise', title: 'Teach my expertise', description: 'Turn your own method into a Worker.' },
];

/** Discovery-only kickoff. The existing authenticated Creator API owns real draft persistence. */
export function WorkerCreateStart({ onStart, disabled }: { onStart: (brief: string) => void; disabled: boolean }) {
  const [path, setPath] = useState<WorkerCreationPath>('describe');
  const [selectedTemplate, setSelectedTemplate] = useState(WORKER_CREATION_STARTERS[0]?.id ?? '');
  // Switching creation paths must not discard a user's unfinished description or method.
  const [goals, setGoals] = useState<Record<WorkerCreationPath, string>>({
    describe: '',
    template: WORKER_CREATION_STARTERS[0]?.brief ?? '',
    expertise: '',
  });
  const [method, setMethod] = useState('');
  const goal = goals[path];
  const brief = workerCreationBrief({ path, goal, ...(path === 'expertise' ? { method } : {}) });

  function chooseTemplate(id: string) {
    const starter = WORKER_CREATION_STARTERS.find((item) => item.id === id);
    if (!starter) return;
    setSelectedTemplate(id);
    setGoals((current) => ({ ...current, template: starter.brief }));
  }

  return (
    <section className="w-full max-w-2xl mx-auto py-3 sm:py-6" aria-labelledby="worker-create-heading">
      <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-2">Create · Worker</p>
      <h1 id="worker-create-heading" className="text-xl sm:text-2xl font-semibold text-text tracking-tight">What should your Worker do?</h1>
      <p className="text-sm text-text-sub mt-2 leading-relaxed">
        Describe a goal, use an editable starting point, or teach your own method. No code required to create a draft.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5" role="group" aria-label="Choose a way to create">
        {PATHS.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => setPath(choice.id)}
            aria-pressed={path === choice.id}
            disabled={disabled}
            className={`text-left rounded-xl border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${path === choice.id ? 'border-primary bg-primary/10' : 'border-border bg-panel hover:bg-panel-raised'}`}
          >
            <span className="text-sm font-medium text-text block">{choice.title}</span>
            <span className="text-xs text-text-muted block mt-1 leading-relaxed">{choice.description}</span>
          </button>
        ))}
      </div>

      {path === 'template' && (
        <div className="mt-5">
          <p className="text-xs font-medium text-text-sub mb-2">Choose a starter brief</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WORKER_CREATION_STARTERS.map((starter) => (
              <button
                key={starter.id}
                type="button"
                onClick={() => chooseTemplate(starter.id)}
                disabled={disabled}
                aria-pressed={selectedTemplate === starter.id}
                className={`text-left border rounded-lg px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${selectedTemplate === starter.id ? 'border-primary bg-primary/10' : 'border-border-dim bg-panel hover:bg-panel-raised'}`}
              >
                <span className="block text-[10px] font-mono text-text-dim mb-1">{starter.category}</span>
                <span className="block text-xs font-semibold text-text">{starter.name}</span>
                <span className="block text-xs text-text-muted mt-0.5 leading-relaxed">{starter.description}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-text-dim mt-2">Templates are editable briefs—not pre-installed capabilities or guaranteed live integrations.</p>
        </div>
      )}

      <form className="mt-5 space-y-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (brief && !disabled) onStart(brief); }}>
        <div>
          <label htmlFor="worker-creation-goal" className="text-xs font-medium text-text-sub block mb-2">
            {path === 'template' ? 'Review and edit the starter' : path === 'expertise' ? 'What expertise or process do you want to turn into a Worker?' : 'Describe the work in your own words'}
          </label>
          <textarea
            id="worker-creation-goal"
            value={goal}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setGoals((current) => ({ ...current, [path]: event.target.value }))}
            maxLength={1800}
            rows={path === 'template' ? 6 : 4}
            disabled={disabled}
            placeholder={path === 'expertise' ? 'I analyze emerging projects for my community. The Worker should...' : 'I want a Worker that researches protocols and tells me what changed and why it matters...'}
            className="block w-full resize-y min-h-[100px] rounded-xl bg-panel-raised border border-border px-3 py-3 text-sm text-text placeholder:text-text-dim focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
          />
        </div>

        {path === 'expertise' && (
          <div>
            <label htmlFor="worker-creation-method" className="text-xs font-medium text-text-sub block mb-2">
              What makes your approach different? <span className="text-text-muted font-normal">(optional; you can teach more later)</span>
            </label>
            <textarea
              id="worker-creation-method"
              value={method}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setMethod(event.target.value)}
              maxLength={1200}
              rows={3}
              disabled={disabled}
              placeholder="I check source quality before scores; I ignore signals that..."
              className="block w-full resize-y rounded-xl bg-panel-raised border border-border px-3 py-3 text-sm text-text placeholder:text-text-dim focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
            />
          </div>
        )}

        <div className="rounded-lg border border-border-dim bg-panel px-3 py-3 text-xs text-text-sub leading-relaxed">
          <span className="font-medium text-text">Private draft first.</span> Agent Builder will interpret your brief and propose a Job Contract. Review, teach and sandbox-test before privately installing or publishing. No wallet authority is granted. Your input is processed by the AI service; do not paste passwords, private keys or API secrets.
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-text-dim">You can edit everything in the next step.</span>
          <button
            type="submit"
            disabled={!brief || disabled}
            className="px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
          >
            Build my draft →
          </button>
        </div>
      </form>
    </section>
  );
}
