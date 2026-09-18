interface OperationalStateNoticeProps {
  status: 'info' | 'warning' | 'needs-you' | 'danger';
  title: string;
  what?: string;
  affected?: string;
  stillSafe?: string;
  stillWorks?: string;
  agentPlaceDoing?: string;
  userAction?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  footer?: string;
  environment?: string;
  className?: string;
}

export function OperationalStateNotice({
  status,
  title,
  what,
  affected,
  stillSafe,
  stillWorks,
  agentPlaceDoing,
  userAction,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  footer,
  environment,
  className = '',
}: OperationalStateNoticeProps) {
  const borderColor =
    status === 'danger' ? 'border-danger/30' :
    status === 'needs-you' ? 'border-warn/40' :
    status === 'warning' ? 'border-warn/20' :
    'border-border';

  const bgColor =
    status === 'danger' ? 'bg-danger/5' :
    status === 'needs-you' ? 'bg-warn/5' :
    status === 'warning' ? 'bg-warn/5' :
    'bg-panel-raised/40';

  const titleColor =
    status === 'danger' ? 'text-danger' :
    status === 'needs-you' ? 'text-warn' :
    status === 'warning' ? 'text-warn' :
    'text-text';

  const rows: Array<{ label: string; value: string; valueColor?: string }> = [];
  if (what) rows.push({ label: 'What happened', value: what });
  if (affected) rows.push({ label: 'Affected', value: affected });
  if (stillSafe) rows.push({ label: 'Still safe', value: stillSafe, valueColor: 'text-accent' });
  if (stillWorks) rows.push({ label: 'Still works', value: stillWorks, valueColor: 'text-accent' });
  if (agentPlaceDoing) rows.push({ label: 'AgentPlace', value: agentPlaceDoing });
  if (userAction) rows.push({ label: 'You', value: userAction, valueColor: 'text-warn' });

  return (
    <div className={`border rounded-lg px-4 py-4 ${borderColor} ${bgColor} ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className={`text-sm font-semibold ${titleColor}`}>{title}</p>
        {environment && (
          <span className="text-[10px] font-mono border border-border rounded px-1.5 py-0.5 text-text-dim shrink-0">{environment}</span>
        )}
      </div>
      {rows.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {rows.map(({ label, value, valueColor }) => (
            <div key={label} className="flex gap-3 text-xs">
              <span className="text-text-dim shrink-0 w-28">{label}</span>
              <span className={valueColor ?? 'text-text-sub'}>{value}</span>
            </div>
          ))}
        </div>
      )}
      {(primaryLabel || secondaryLabel) && (
        <div className="flex gap-2 flex-wrap">
          {primaryLabel && onPrimary && (
            <button
              onClick={onPrimary}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors ${
                status === 'danger' ? 'bg-danger text-white hover:opacity-90' :
                status === 'needs-you' ? 'bg-primary text-white hover:bg-primary-hover' :
                'bg-primary text-white hover:bg-primary-hover'
              }`}
            >
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="px-3.5 py-1.5 text-xs text-text-sub border border-border rounded hover:bg-panel hover:text-text transition-colors"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
      {footer && (
        <p className="text-[10px] text-text-dim mt-3">{footer}</p>
      )}
    </div>
  );
}
