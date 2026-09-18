import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { Notification, NotificationLevel } from '../state/types';

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

const LEVEL_LABEL: Record<NotificationLevel, string> = {
  informational: 'Update',
  important: 'Important',
  'needs-you': 'Needs you',
  critical: 'Critical',
};

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  informational: 'text-text-muted',
  important: 'text-primary',
  'needs-you': 'text-warn',
  critical: 'text-danger',
};

const LEVEL_DOT: Record<NotificationLevel, string> = {
  informational: 'bg-text-muted',
  important: 'bg-primary',
  'needs-you': 'bg-warn',
  critical: 'bg-danger',
};

function NotifRow({ notif }: { notif: Notification }) {
  const dispatch = useDispatch();

  function handleClick() {
    dispatch({ type: 'MARK_NOTIFICATION_READ', id: notif.id });
    dispatch({ type: 'SET_NOTIFICATION_INBOX_OPEN', open: false });

    if (!notif.target) return;
    const { type, id } = notif.target;
    if (type === 'routine') {
      dispatch({ type: 'SET_VIEW', view: 'routines' });
      dispatch({ type: 'SET_ACTIVE_ROUTINE', id });
    } else if (type === 'job') {
      dispatch({ type: 'SET_ACTIVE_JOB', id });
    } else if (type === 'action') {
      dispatch({ type: 'SET_ACTIVE_ACTION', id });
    } else if (type === 'worker') {
      dispatch({ type: 'SET_ACTIVE_WORKER', id });
    } else if (type === 'wallet') {
      dispatch({ type: 'SET_VIEW', view: 'wallets' });
      dispatch({ type: 'SET_ACTIVE_WALLET', id });
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left px-4 py-3.5 rounded-lg border transition-colors cursor-pointer hover:bg-panel ${
        notif.read ? 'border-border-dim' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 shrink-0">
          <span className={`w-2 h-2 rounded-full block ${notif.read ? 'bg-text-dim' : LEVEL_DOT[notif.level]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-sm font-medium text-text leading-snug">{notif.title}</p>
            <span className={`text-[10px] font-mono uppercase tracking-wider shrink-0 ${LEVEL_COLOR[notif.level]}`}>
              {LEVEL_LABEL[notif.level]}
            </span>
          </div>
          <p className="text-xs text-text-muted mb-1.5">{notif.summary}</p>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-text-dim italic">{notif.why}</p>
            <span className="text-[10px] font-mono text-text-dim shrink-0 ml-2">{timeAgo(notif.createdAt)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function PreferencesPanel({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const dispatch = useDispatch();
  const prefs = state.notificationPreferences;

  return (
    <div className="border-t border-border-dim pt-4 mt-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-text">Notification preferences</p>
        <button onClick={onClose} className="text-xs text-text-muted hover:text-text">Done</button>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-sub">Quiet hours</p>
            <p className="text-[10px] text-text-muted">
              {prefs.quietHoursEnabled ? `${prefs.quietHoursStart} – ${prefs.quietHoursEnd}` : 'Disabled'}
            </p>
          </div>
          <button
            onClick={() =>
              dispatch({
                type: 'UPDATE_NOTIFICATION_PREFERENCES',
                updates: { quietHoursEnabled: !prefs.quietHoursEnabled },
              })
            }
            className={`w-10 h-5 rounded-full transition-colors relative ${
              prefs.quietHoursEnabled ? 'bg-primary' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                prefs.quietHoursEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {prefs.quietHoursEnabled && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-text-sub">Critical bypass quiet hours</p>
              <p className="text-[10px] text-text-muted">Allow Critical notifications through</p>
            </div>
            <button
              onClick={() =>
                dispatch({
                  type: 'UPDATE_NOTIFICATION_PREFERENCES',
                  updates: { criticalBypassQuietHours: !prefs.criticalBypassQuietHours },
                })
              }
              className={`w-10 h-5 rounded-full transition-colors relative ${
                prefs.criticalBypassQuietHours ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  prefs.criticalBypassQuietHours ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}
        <div>
          <p className="text-xs text-text-sub mb-1.5">Lock-screen / preview detail</p>
          <div className="space-y-1">
            {(['full', 'hide-amounts', 'private'] as const).map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={prefs.lockScreenDetail === opt}
                  onChange={() =>
                    dispatch({
                      type: 'UPDATE_NOTIFICATION_PREFERENCES',
                      updates: { lockScreenDetail: opt },
                    })
                  }
                />
                <span className="text-xs text-text-sub capitalize">
                  {opt === 'hide-amounts' ? 'Hide amounts' : opt === 'private' ? 'Private previews' : 'Full details'}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotificationInbox() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showPrefs, setShowPrefs] = useState(false);

  const notifications = state.notifications ?? [];
  const critical = notifications.filter((n) => n.level === 'critical');
  const needsYou = notifications.filter((n) => n.level === 'needs-you');
  const important = notifications.filter((n) => n.level === 'important');
  const updates = notifications.filter((n) => n.level === 'informational');
  const unreadCount = notifications.filter((n) => !n.read).length;

  function close() {
    dispatch({ type: 'SET_NOTIFICATION_INBOX_OPEN', open: false });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" style={{ pointerEvents: 'none' }}>
      <div
        className="flex-1 bg-bg/60 backdrop-blur-sm"
        style={{ pointerEvents: 'all' }}
        onClick={close}
      />
      <div
        className="w-full max-w-sm h-full bg-panel border-l border-border shadow-2xl flex flex-col overflow-hidden"
        style={{ pointerEvents: 'all' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-dim flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text">Notifications</h2>
            {unreadCount > 0 && (
              <span className="text-xs bg-warn text-white rounded-full px-1.5 py-0.5 font-mono font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' })}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowPrefs((v) => !v)}
              className="text-text-muted hover:text-text p-1 transition-colors"
              title="Notification preferences"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
                <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
              </svg>
            </button>
            <button onClick={close} className="text-text-muted hover:text-text p-1 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {notifications.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted">No notifications</p>
            </div>
          )}

          {critical.length > 0 && (
            <section>
              <p className="text-[10px] font-mono uppercase tracking-wider text-danger mb-2">Critical</p>
              <div className="space-y-2">
                {critical.map((n) => <NotifRow key={n.id} notif={n} />)}
              </div>
            </section>
          )}

          {needsYou.length > 0 && (
            <section>
              <p className="text-[10px] font-mono uppercase tracking-wider text-warn mb-2">Needs you</p>
              <div className="space-y-2">
                {needsYou.map((n) => <NotifRow key={n.id} notif={n} />)}
              </div>
            </section>
          )}

          {important.length > 0 && (
            <section>
              <p className="text-[10px] font-mono uppercase tracking-wider text-primary mb-2">Important</p>
              <div className="space-y-2">
                {important.map((n) => <NotifRow key={n.id} notif={n} />)}
              </div>
            </section>
          )}

          {updates.length > 0 && (
            <section>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-dim mb-2">Updates</p>
              <div className="space-y-2">
                {updates.map((n) => <NotifRow key={n.id} notif={n} />)}
              </div>
            </section>
          )}

          {showPrefs && <PreferencesPanel onClose={() => setShowPrefs(false)} />}
        </div>
      </div>
    </div>
  );
}
