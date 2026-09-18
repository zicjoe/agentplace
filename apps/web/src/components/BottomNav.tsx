import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';

export function BottomNav() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [showMore, setShowMore] = useState(false);

  const isActive = (view: string) =>
    state.activeConversationId === null &&
    state.activeWorkerId === null &&
    state.activeJobId === null &&
    state.activeView === view;

  const isGuest = !state.user;

  const guestNavItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      id: 'discover',
      label: 'Discover',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <path strokeLinecap="round" strokeWidth={1.8} d="M16.24 7.76l-4.24 2.83-2.83 4.24 4.24-2.83 2.83-4.24z" />
        </svg>
      ),
    },
    {
      id: '__create__',
      label: 'Create',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      id: 'more',
      label: 'More',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
  ];

  const signedInNavItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      id: 'discover',
      label: 'Discover',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <path strokeLinecap="round" strokeWidth={1.8} d="M16.24 7.76l-4.24 2.83-2.83 4.24 4.24-2.83 2.83-4.24z" />
        </svg>
      ),
    },
    {
      id: 'workers',
      label: 'Workers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="9" cy="7" r="3" strokeWidth={1.8} />
          <path strokeLinecap="round" strokeWidth={1.8} d="M3 20a6 6 0 0112 0" />
          <path strokeLinecap="round" strokeWidth={1.8} d="M18 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'more',
      label: 'More',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
  ];

  const navItems = isGuest ? guestNavItems : signedInNavItems;

  const moreItems = [
    { id: 'routines', label: 'Routines' },
    { id: 'wallets', label: 'Wallets' },
    { id: 'security', label: 'Security & Authority' },
    { id: 'billing', label: 'Billing & Usage' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <>
      {/* More menu */}
      {showMore && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-panel border-t border-border px-4 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">More</p>
              <button
                onClick={() => {
                  dispatch({ type: 'SET_SHOW_CREATE', show: true });
                  setShowMore(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs rounded font-medium hover:bg-primary-hover transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    dispatch({ type: 'SET_VIEW', view: item.id as any });
                    setShowMore(false);
                  }}
                  className="text-left px-3 py-2.5 rounded border border-border text-sm text-text-sub hover:text-text hover:bg-panel-raised transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Conversation drawer trigger */}
            <button
              onClick={() => {
                dispatch({ type: 'SET_MOBILE_DRAWER', open: true });
                setShowMore(false);
              }}
              className="w-full mt-2 text-left px-3 py-2.5 rounded border border-border text-sm text-text-sub hover:text-text hover:bg-panel-raised transition-colors"
            >
              History
            </button>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <div className="h-16 bg-surface border-t border-border flex items-center px-2 shrink-0">
        {navItems.map((item) => {
          const active = item.id === 'more' ? showMore : isActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'more') {
                  setShowMore((v) => !v);
                } else if (item.id === '__create__') {
                  dispatch({ type: 'SET_SHOW_CREATE', show: true });
                  setShowMore(false);
                } else {
                  dispatch({ type: 'SET_VIEW', view: item.id as any });
                  setShowMore(false);
                }
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded transition-colors ${
                active ? 'text-primary' : 'text-text-muted hover:text-text-sub'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
