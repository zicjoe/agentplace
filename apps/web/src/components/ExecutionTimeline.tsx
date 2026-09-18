interface TimelineStep {
  label: string;
  status: 'done' | 'active' | 'pending' | 'error' | 'unknown';
}

interface ExecutionTimelineProps {
  steps: TimelineStep[];
}

export function ExecutionTimeline({ steps }: ExecutionTimelineProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <div key={step.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                step.status === 'done' ? 'bg-accent' :
                step.status === 'active' ? 'bg-primary' :
                step.status === 'error' ? 'bg-danger' :
                step.status === 'unknown' ? 'bg-warn' :
                'border border-border bg-panel'
              }`}>
                {step.status === 'done' && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {step.status === 'active' && (
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
                {step.status === 'unknown' && (
                  <span className="text-[8px] text-white font-bold">?</span>
                )}
              </div>
              {!isLast && (
                <div className={`w-px flex-1 my-0.5 ${step.status === 'done' ? 'bg-accent/30' : 'bg-border'}`} style={{ minHeight: 16 }} />
              )}
            </div>
            <div className={`pb-4 ${isLast ? '' : ''}`}>
              <span className={`text-xs ${
                step.status === 'done' ? 'text-accent' :
                step.status === 'active' ? 'text-primary' :
                step.status === 'error' ? 'text-danger' :
                step.status === 'unknown' ? 'text-warn' :
                'text-text-muted'
              }`}>
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
