import { useState } from 'react';
import { useAppState, useDispatch, runRoutineNow, uid } from '../state/AppContext';
import type { RoutineStatus, RoutineRun } from '../state/types';

function timeAgo(date: Date | undefined): string {
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

function timeUntil(date: Date | undefined): string {
  if (!date) return '—';
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Due now';
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hrs < 1) return 'In <1 hour';
  if (hrs < 24) return `In ${hrs}h`;
  if (days === 1) return 'Tomorrow morning';
  return `In ${days}d`;
}

const STATUS_LABEL: Record<RoutineStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  watching: 'Watching',
  'waiting-for-event': 'Waiting for event',
  'cooling-down': 'Cooling down',
  paused: 'Paused',
  limited: 'Limited',
  'needs-you': 'Needs you',
  expired: 'Expired',
  stopped: 'Stopped',
};

function RunRow({ run, onOpenJob }: { run: RoutineRun; onOpenJob: (jobId: string) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border-dim last:border-0">
      <div>
        <p className="text-xs text-text-sub">{timeAgo(run.startedAt)}</p>
        <p className="text-xs text-text-muted mt-0.5">{run.summary}</p>
      </div>
      {run.jobId && (
        <button
          onClick={() => onOpenJob(run.jobId!)}
          className="text-xs text-primary hover:underline shrink-0"
        >
          Open job →
        </button>
      )}
    </div>
  );
}

function EditRoutineForm({ routineId, onClose }: { routineId: string; onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const routine = (state.routines ?? []).find((r) => r.id === routineId);
  const [instruction, setInstruction] = useState(routine?.instruction ?? '');
  const [notifRule, setNotifRule] = useState(routine?.notificationRule ?? '');
  const [execBehavior, setExecBehavior] = useState(routine?.executionBehavior ?? 'recommend-only');

  if (!routine) return null;

  const hasGrant = !!routine.authorityGrantId ||
    (state.authorityGrants ?? []).some((g) => g.workerId === routine.workerId && g.status === 'active');

  function save() {
    dispatch({
      type: 'UPDATE_ROUTINE',
      routineId,
      updates: { instruction, notificationRule: notifRule, executionBehavior: execBehavior as any },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-panel border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border-dim flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Edit Routine</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim block mb-1.5">
              Instruction
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={3}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text placeholder-text-muted outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim block mb-1.5">
              Notification rule
            </label>
            <input
              value={notifRule}
              onChange={(e) => setNotifRule(e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text placeholder-text-muted outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-text-dim block mb-2">
              Execution behavior
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={execBehavior === 'recommend-only'}
                  onChange={() => setExecBehavior('recommend-only')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm text-text">Recommend only</p>
                  <p className="text-xs text-text-muted">Surface findings without executing actions</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={execBehavior === 'act-within-authority'}
                  onChange={() => setExecBehavior('act-within-authority')}
                  className="mt-0.5"
                  disabled={!hasGrant}
                />
                <div>
                  <p className={`text-sm ${hasGrant ? 'text-text' : 'text-text-muted'}`}>
                    May act within existing authority
                  </p>
                  <p className="text-xs text-text-muted">
                    {hasGrant
                      ? "This does not change the Worker's financial authority. It only allows this Routine to use authority that already exists."
                      : 'No active authority grant for this Worker. Keep recommend-only or review authority first.'}
                  </p>
                  {!hasGrant && execBehavior === 'act-within-authority' && (
                    <p className="text-xs text-warn mt-1">
                      No appropriate authority exists. Keeping recommend-only.
                    </p>
                  )}
                </div>
              </label>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border-dim flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text rounded border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 text-sm bg-primary text-white rounded font-medium hover:bg-primary-hover transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirm({ routineId, onClose }: { routineId: string; onClose: () => void }) {
  const dispatch = useDispatch();

  function confirm() {
    dispatch({ type: 'UPDATE_ROUTINE', routineId, updates: { status: 'stopped' } });
    dispatch({
      type: 'ADD_ACTIVITY_EVENT',
      event: {
        id: uid(),
        eventType: 'routine',
        title: 'Routine stopped',
        summary: 'Future runs stopped · Historical Jobs and outcomes remain',
        routineId,
        timestamp: new Date(),
        status: 'complete',
      },
    });
    dispatch({ type: 'SET_ACTIVE_ROUTINE', id: null });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-panel border border-border rounded-xl shadow-2xl p-5">
        <h2 className="text-sm font-semibold text-text mb-2">Stop this Routine?</h2>
        <p className="text-xs text-text-sub leading-relaxed mb-1">Future runs will stop.</p>
        <p className="text-xs text-text-sub leading-relaxed mb-1">Historical Jobs and outcomes remain available.</p>
        <p className="text-xs text-text-sub leading-relaxed mb-4">Stopping a Routine does not remove the Worker or revoke Authority Grants.</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm text-text-muted border border-border rounded hover:text-text transition-colors"
          >
            Keep Routine
          </button>
          <button
            onClick={confirm}
            className="flex-1 px-3 py-2 text-sm bg-danger text-white rounded font-medium hover:opacity-90 transition-opacity"
          >
            Stop Routine
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoutineWorkspace() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showEdit, setShowEdit] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const routine = (state.routines ?? []).find((r) => r.id === state.activeRoutineId);

  const runs = routine ? (state.routineRuns ?? []).filter((r) => r.routineId === routine.id) : [];
  const grant = routine ? (state.authorityGrants ?? []).find(
    (g) => g.workerId === routine.workerId && g.status === 'active'
  ) : undefined;
  const isLimited = routine?.status === 'limited';
  const isPaused = routine?.status === 'paused';
  const isStopped = routine?.status === 'stopped';
  const canRunNow = !isStopped && !isLimited;

  function handlePause() {
    if (!routine) return;
    dispatch({ type: 'UPDATE_ROUTINE', routineId: routine.id, updates: { status: 'paused' } });
  }

  function handleResume() {
    if (!routine) return;
    const nextStatus =
      routine.trigger.type === 'scheduled' ? 'active'
      : routine.trigger.type === 'condition' ? 'watching'
      : 'waiting-for-event';
    dispatch({ type: 'UPDATE_ROUTINE', routineId: routine.id, updates: { status: nextStatus as any, limitedReason: undefined } });
  }

  function handleRunNow() {
    if (!routine) return;
    runRoutineNow(dispatch, routine.id);
  }

  function openJob(jobId: string) {
    dispatch({ type: 'SET_ACTIVE_JOB', id: jobId });
    dispatch({ type: 'SET_ACTIVE_ROUTINE', id: null });
  }

  if (!routine) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <p className="text-sm text-text-muted">Routine not found</p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col bg-bg overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-dim shrink-0">
          <div className="flex items-start gap-3">
            <button
              onClick={() => dispatch({ type: 'SET_ACTIVE_ROUTINE', id: null })}
              className="text-text-muted hover:text-text p-1 -ml-1 mt-0.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-text leading-tight">{routine.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_ACTIVE_ROUTINE', id: null });
                    dispatch({ type: 'SET_ACTIVE_WORKER', id: routine.workerId });
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  {routine.workerName}
                </button>
                <span className="text-text-dim text-xs">·</span>
                <span className={`text-xs font-mono ${
                  isLimited ? 'text-warn' :
                  routine.status === 'active' ? 'text-accent' :
                  ['watching', 'waiting-for-event'].includes(routine.status) ? 'text-primary' :
                  'text-text-muted'
                }`}>
                  {STATUS_LABEL[routine.status]}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 max-w-2xl space-y-6">

            {/* Limited warning */}
            {isLimited && (
              <div className="border border-warn/30 bg-warn/5 rounded-lg px-4 py-4 space-y-3">
                <p className="text-sm font-semibold text-warn">Limited</p>
                <div className="space-y-1.5">
                  {[
                    ['What happened', routine.limitedReason ?? 'Repeated provider failures exhausted this Routine\'s retry budget.'],
                    ['Affected', 'Future scheduled checks are limited. This Routine will not start additional attempts until reviewed.'],
                    ['Still works', `${routine.workerName} remains available for manual research. Financial authority is unchanged.`],
                    ['AgentPlace', 'Holding further scheduled attempts until you review.'],
                    ['You', 'Review this Routine and choose how to continue.'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-3 text-xs">
                      <span className="text-text-dim w-28 shrink-0">{k}</span>
                      <span className={k === 'Still works' ? 'text-accent' : 'text-text-sub'}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => {
                      const jobId = runRoutineNow(dispatch, routine.id);
                      dispatch({ type: 'UPDATE_ROUTINE', routineId: routine.id, updates: { status: 'active', limitedReason: undefined } });
                      dispatch({ type: 'SET_ACTIVE_JOB', id: jobId });
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                  >
                    Retry this check once
                  </button>
                  <button
                    onClick={handleResume}
                    className="px-3 py-1.5 text-xs border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
                  >
                    Resume future checks
                  </button>
                  <button
                    onClick={handlePause}
                    className="px-3 py-1.5 text-xs border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => setShowEdit(true)}
                    className="px-3 py-1.5 text-xs border border-border text-text-sub rounded hover:bg-panel hover:text-text transition-colors"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-[10px] text-text-dim">Retry once ≠ Resume. Retry runs one check now. Resume restores scheduled triggering.</p>
              </div>
            )}

            {/* Core details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Trigger</p>
                <p className="text-sm text-text-sub">{routine.trigger.humanReadable}</p>
                {routine.trigger.conditionThreshold && (
                  <p className="text-xs text-text-muted mt-0.5">{routine.trigger.conditionThreshold}</p>
                )}
                {routine.trigger.eventThreshold && (
                  <p className="text-xs text-text-muted mt-0.5">Threshold: {routine.trigger.eventThreshold}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Instruction</p>
                <p className="text-sm text-text-sub leading-relaxed">{routine.instruction}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Execution behavior</p>
                <p className="text-sm text-text-sub">
                  {routine.executionBehavior === 'recommend-only' ? 'Recommend only' : `May act within ${routine.workerName}'s existing mandate`}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Notifications</p>
                <p className="text-sm text-text-sub">{routine.notificationRule}</p>
              </div>
            </div>

            {/* Authority */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Authority</p>
              {grant ? (
                <div className="border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span className="text-xs font-medium text-accent">Capital authority · from {routine.workerName} mandate</span>
                  </div>
                  <div className="text-xs text-text-muted space-y-0.5">
                    <p>Managed capital: {grant.totalManagedCapital}</p>
                    <p>Per-action limit: {grant.singleActionLimit}</p>
                    <p>Networks: {grant.networks.join(' · ')}</p>
                  </div>
                  <p className="text-xs text-text-dim mt-2">
                    This Routine may reference this authority. It did not create it and cannot widen it.
                  </p>
                </div>
              ) : (
                <div className="border border-border-dim rounded-lg px-4 py-3">
                  <p className="text-xs text-text-muted">No financial authority. {routine.workerName} operates in research mode only.</p>
                </div>
              )}
            </div>

            {/* Budgets */}
            <div className="grid grid-cols-2 gap-4">
              {routine.serviceBudgetStructured ? (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">AgentPlace service budget</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Spent</span>
                      <span className="text-text-sub">${routine.serviceBudgetStructured.spentUsd.toFixed(2)} / ${routine.serviceBudgetStructured.limitUsd.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-panel-raised rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, (routine.serviceBudgetStructured.spentUsd / routine.serviceBudgetStructured.limitUsd) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-dim">${(routine.serviceBudgetStructured.limitUsd - routine.serviceBudgetStructured.spentUsd).toFixed(2)} remaining · {routine.serviceBudgetStructured.periodDays}d period</p>
                    <p className="text-[10px] text-text-dim">Service budget ≠ capital authority. Capital authority is set separately in Security &amp; Authority.</p>
                  </div>
                </div>
              ) : routine.serviceBudget && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Service budget</p>
                  <p className="text-xs text-text-sub">{routine.serviceBudget}</p>
                </div>
              )}
              {routine.gasBudget && (
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Execution / gas budget</p>
                  <p className="text-xs text-text-sub">{routine.gasBudget}</p>
                </div>
              )}
            </div>

            {/* Timing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">Last meaningful run</p>
                <p className="text-sm text-text-sub">{timeAgo(routine.lastMeaningfulActionAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-1.5">
                  {routine.trigger.type === 'event' ? 'Waiting for' : 'Next run'}
                </p>
                <p className="text-sm text-text-sub">
                  {routine.trigger.type === 'event'
                    ? routine.trigger.humanReadable
                    : routine.nextRunAt ? timeUntil(routine.nextRunAt) : '—'}
                </p>
              </div>
            </div>

            {/* Recent runs */}
            {runs.length > 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Recent runs</p>
                <div className="border border-border rounded-lg px-4">
                  {runs.slice(0, 5).map((run) => (
                    <RunRow key={run.id} run={run} onOpenJob={openJob} />
                  ))}
                </div>
              </div>
            )}
            {runs.length === 0 && (
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Recent runs</p>
                <p className="text-xs text-text-muted">No runs yet</p>
              </div>
            )}

            {/* Controls */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Controls</p>
              <div className="flex flex-wrap gap-2">
                {canRunNow && (
                  <button
                    onClick={handleRunNow}
                    className="px-3 py-2 text-xs bg-primary text-white rounded font-medium hover:bg-primary-hover transition-colors"
                  >
                    Run now
                  </button>
                )}
                {!isStopped && !isPaused && !isLimited && (
                  <button
                    onClick={handlePause}
                    className="px-3 py-2 text-xs border border-border text-text-sub rounded hover:text-text transition-colors"
                  >
                    Pause
                  </button>
                )}
                {(isPaused || isLimited) && (
                  <button
                    onClick={handleResume}
                    className="px-3 py-2 text-xs border border-border text-text-sub rounded hover:text-text transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => setShowEdit(true)}
                  className="px-3 py-2 text-xs border border-border text-text-sub rounded hover:text-text transition-colors"
                >
                  Edit
                </button>
                {!isStopped && (
                  <button
                    onClick={() => setShowRemove(true)}
                    className="px-3 py-2 text-xs border border-border text-danger/70 rounded hover:text-danger transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showEdit && (
        <EditRoutineForm routineId={routine.id} onClose={() => setShowEdit(false)} />
      )}
      {showRemove && (
        <RemoveConfirm routineId={routine.id} onClose={() => setShowRemove(false)} />
      )}
    </>
  );
}
