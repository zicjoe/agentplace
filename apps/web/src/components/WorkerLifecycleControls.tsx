import { useEffect, useRef, useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { Worker } from '../state/types';
import { WEB_RUNTIME_SETTINGS } from '../platform/runtime';
import { fetchWorkState, updateDurableWorkerStatus } from '../platform/workApi';
import { workerLifecycleConfirmation, workerLifecycleDependencies, type WorkerLifecycleAction } from '../platform/workerLifecycle';

/** Shared lifecycle controls for My Workers and the Worker workspace; one durable mutation path. */
export function WorkerLifecycleControls({ worker, onRemoved }: { worker: Worker; onRemoved?: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [busy, setBusy] = useState<WorkerLifecycleAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const accountId = useRef(state.user?.id);
  accountId.current = state.user?.id;
  const related = workerLifecycleDependencies(worker.id, state.jobs, state.routines, state.authorityGrants);

  async function run(action: WorkerLifecycleAction) {
    if (inFlight.current) return;
    const requestedBy = state.user?.id;
    const ok = window.confirm(workerLifecycleConfirmation(worker, action, related));
    if (!ok) return;
    const target = action === 'pause' ? 'paused' : action === 'remove' ? 'removed' : 'standby';
    inFlight.current = true;
    setBusy(action);
    setError(null);
    try {
      if (WEB_RUNTIME_SETTINGS.dataMode === 'api') {
        const saved = await updateDurableWorkerStatus(worker.id, target);
        // A successfully acknowledged backend update must never look like an unsuccessful write
        // merely because a subsequent read or network refresh is temporarily unavailable.
        if (!mounted.current || accountId.current !== requestedBy) return;
        if (action === 'remove') {
          dispatch({ type: 'SET_WORKERS', workers: state.workers.filter((value) => value.id !== worker.id) });
          onRemoved?.();
        } else {
          dispatch({ type: 'UPDATE_WORKER', workerId: worker.id, updates: { status: saved.status } });
        }
        try {
          const work = await fetchWorkState();
          // An account switch during an in-flight refresh must never hydrate another account's UI.
          if (!mounted.current || accountId.current !== requestedBy) return;
          dispatch({ type: 'SET_WORKERS', workers: work.workers });
          dispatch({ type: 'SET_JOBS', jobs: work.jobs });
          dispatch({ type: 'SET_ACTIVITY_EVENTS', events: work.activity });
        } catch {
          if (mounted.current && accountId.current === requestedBy) {
            setError('Worker change saved, but work status could not refresh. Reload to sync Jobs and activity.');
          }
        }
      } else if (action === 'remove') {
        dispatch({ type: 'SET_WORKERS', workers: state.workers.filter((value) => value.id !== worker.id) });
      } else {
        dispatch({ type: 'UPDATE_WORKER', workerId: worker.id, updates: { status: action === 'pause' ? 'paused' : 'standby' } });
      }
      if (WEB_RUNTIME_SETTINGS.dataMode !== 'api' && action === 'remove') onRemoved?.();
    } catch (value) {
      if (mounted.current && accountId.current === requestedBy) setError(value instanceof Error ? value.message : 'Worker update failed.');
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3 items-center flex-wrap">
        <button type="button" disabled={busy !== null} onClick={() => void run(worker.status === 'paused' ? 'resume' : 'pause')}
          className="text-xs text-primary hover:underline disabled:opacity-50 rounded focus-visible:outline-2 focus-visible:outline-primary">
          {busy === 'pause' ? 'Pausing…' : busy === 'resume' ? 'Resuming…' : worker.status === 'paused' ? 'Resume Worker' : 'Pause Worker'}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void run('remove')}
          className="text-xs text-text-muted hover:text-danger disabled:opacity-50 rounded focus-visible:outline-2 focus-visible:outline-primary">
          {busy === 'remove' ? 'Removing…' : 'Remove Worker'}
        </button>
      </div>
      {(related.liveRoutines > 0 || related.independentGrants > 0) && (
        <p className="text-[11px] text-text-muted leading-relaxed">
          {related.liveRoutines > 0 ? `${related.liveRoutines} separately managed routine(s). ` : ''}
          {related.independentGrants > 0 ? `${related.independentGrants} existing permission grant(s). ` : ''}
          Pausing or removing does not revoke these.
        </p>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
