import { useEffect, useState, useRef } from 'react';
import { useAppState, useDispatch, makeMemeScoutWorker } from '../state/AppContext';
import type { Conversation } from '../state/types';
import { fetchConversations } from '../platform/conversationApi';
import { WEB_RUNTIME_SETTINGS } from '../platform/runtime';

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

interface ConvItemProps {
  conv: Conversation;
  isActive: boolean;
}

function ConvItem({ conv, isActive }: ConvItemProps) {
  const dispatch = useDispatch();
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(conv.title);
  const menuRef = useRef<HTMLDivElement>(null);

  function open() {
    dispatch({ type: 'SET_ACTIVE_CONV', id: conv.id });
    setShowMenu(false);
  }

  function commitRename() {
    if (renameVal.trim()) {
      dispatch({ type: 'RENAME_CONV', convId: conv.id, title: renameVal.trim() });
    }
    setRenaming(false);
    setShowMenu(false);
  }

  if (renaming) {
    return (
      <div className="px-2 py-1">
        <input
          autoFocus
          className="w-full bg-panel-raised border border-primary text-text text-sm px-2 py-1 rounded outline-none"
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setRenaming(false);
          }}
          onBlur={commitRename}
        />
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={open}
        className={`w-full text-left px-3 py-1.5 rounded flex items-center gap-2 transition-colors text-sm ${
          isActive
            ? 'bg-panel-raised text-text'
            : 'text-text-sub hover:bg-panel hover:text-text'
        }`}
      >
        {conv.pinned && (
          <svg className="w-3 h-3 text-text-muted shrink-0" fill="currentColor" viewBox="0 0 16 16">
            <path d="M9.828 1.293a1 1 0 0 1 1.414 0l3.465 3.465a1 1 0 0 1 0 1.414l-1.172 1.172a1 1 0 0 1-.672.287H12l-1 1v.75a1 1 0 0 1-.293.707L9.293 11.3a1 1 0 0 1-1.586-1.214l.293-.293-.75-.75-.293.293a1 1 0 0 1-1.414-1.414l.293-.293-.75-.75L5.586 7.4a1 1 0 0 1-1.172-1.586l1.414-1.414a1 1 0 0 1 .707-.293H7v-.137a1 1 0 0 1 .293-.707L8.414 2.15l1.414-1.414z" />
          </svg>
        )}
        <span className="truncate flex-1">{conv.title}</span>
        <span className="text-text-dim text-xs shrink-0 hidden group-hover:hidden">
          {timeAgo(conv.updatedAt)}
        </span>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu((v) => !v);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-text hover:bg-panel-raised transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-2 top-8 z-50 bg-panel-raised border border-border rounded shadow-xl py-1 w-40"
        >
          <button
            onClick={() => { setRenaming(true); setShowMenu(false); }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-sub hover:text-text hover:bg-panel transition-colors"
          >
            Rename
          </button>
          <button
            onClick={() => {
              dispatch({ type: 'PIN_CONV', convId: conv.id, pinned: !conv.pinned });
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-sub hover:text-text hover:bg-panel transition-colors"
          >
            {conv.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={() => {
              dispatch({ type: 'ARCHIVE_CONV', convId: conv.id });
              setShowMenu(false);
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-text-sub hover:text-text hover:bg-panel transition-colors"
          >
            Archive
          </button>
        </div>
      )}
    </div>
  );
}

function ArchivedConvItem({ conv, isActive }: ConvItemProps) {
  const dispatch = useDispatch();
  return (
    <div className="relative group">
      <button
        onClick={() => dispatch({ type: 'SET_ACTIVE_CONV', id: conv.id })}
        className={`w-full text-left px-3 py-1.5 rounded flex items-center gap-2 transition-colors text-sm ${
          isActive ? 'bg-panel-raised text-text' : 'text-text-dim hover:bg-panel hover:text-text-sub'
        }`}
      >
        <span className="truncate flex-1">{conv.title}</span>
      </button>
      <button
        onClick={() => dispatch({ type: 'UNARCHIVE_CONV', convId: conv.id })}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-text hover:bg-panel-raised transition-all text-xs"
        title="Unarchive"
      >
        ↩
      </button>
    </div>
  );
}

interface SidebarProps {
  isMobileDrawer?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ isMobileDrawer = false, onCloseMobile }: SidebarProps) {
  const state = useAppState();
  const dispatch = useDispatch();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [remoteSearchResults, setRemoteSearchResults] = useState<Conversation[] | null>(null);

  const [showArchived, setShowArchived] = useState(false);
  const allConvs = state.conversations;
  const visibleConvs = allConvs.filter((c) => !c.archived);
  const archivedConvs = allConvs.filter((c) => c.archived);
  const pinned = visibleConvs.filter((c) => c.pinned);
  const recent = visibleConvs.filter((c) => !c.pinned).slice(0, 8);

  const localSearchResults = searchQuery
    ? allConvs.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];
  const searchResults = remoteSearchResults ?? localSearchResults;

  const isAuthenticated = !!state.user;

  useEffect(() => {
    if (!searchQuery.trim() || !isAuthenticated || WEB_RUNTIME_SETTINGS.dataMode !== 'api') {
      setRemoteSearchResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void fetchConversations(searchQuery).then((results) => {
        if (!cancelled) setRemoteSearchResults(results);
      }).catch(() => {
        if (!cancelled) setRemoteSearchResults(null);
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, isAuthenticated]);

  const navItems = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'discover', label: 'Discover', icon: DiscoverIcon },
    ...(isAuthenticated
      ? [
          { id: 'workers', label: 'Workers', icon: WorkersIcon, badge: state.workers.filter(w => w.status === 'needs-you').length || null },
          { id: 'routines', label: 'Routines', icon: RoutinesIcon },
          { id: 'activity', label: 'Activity', icon: ActivityIcon },
          { id: 'wallets', label: 'Wallets', icon: WalletsIcon },
        ]
      : []),
  ] as const;

  function handleLogoClick() {
    const count = logoClickCount + 1;
    setLogoClickCount(count);
    if (count >= 3) {
      dispatch({ type: 'TOGGLE_DEMO' });
      setLogoClickCount(0);
    }
    setTimeout(() => setLogoClickCount(0), 1500);
  }

  function newConversation() {
    dispatch({ type: 'SET_ACTIVE_CONV', id: null });
    dispatch({ type: 'SET_VIEW', view: 'home' });
    if (onCloseMobile) onCloseMobile();
  }

  return (
    <div
      className={`flex flex-col h-full bg-surface ${
        isMobileDrawer ? 'w-72' : 'w-64 border-r border-border'
      }`}
    >
      {/* Wordmark */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2">
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 group"
          title="AgentPlace"
        >
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold tracking-tight">AP</span>
          </div>
          <span className="text-text font-semibold text-[15px] tracking-tight">
            AgentPlace
          </span>
        </button>
        <div className="ml-auto flex items-center gap-1">
          {isAuthenticated && (
            <button
              onClick={() => dispatch({ type: 'SET_NOTIFICATION_INBOX_OPEN', open: true })}
              className="relative p-1.5 text-text-muted hover:text-text transition-colors rounded"
              title="Notifications"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {(state.notifications ?? []).filter((n) => !n.read).length > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-warn" />
              )}
            </button>
          )}
          {isMobileDrawer && (
            <button
              onClick={onCloseMobile}
              className="text-text-muted hover:text-text p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Environment badge */}
      <div className="px-4 pb-3">
        <button
          onClick={() =>
            dispatch({
              type: 'SET_ENV',
              env: state.environment === 'mainnet' ? 'testnet' : 'mainnet',
            })
          }
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
            state.environment === 'mainnet'
              ? 'bg-accent-dim text-accent border border-accent/20'
              : 'bg-warn/10 text-warn border border-warn/20'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              state.environment === 'mainnet' ? 'bg-accent' : 'bg-warn'
            }`}
          />
          {state.environment === 'mainnet' ? 'Mainnet' : 'Testnet'}
        </button>
      </div>

      {/* New + Search */}
      <div className="px-3 pb-2 flex flex-col gap-1">
        <button
          onClick={newConversation}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm text-text-sub hover:text-text hover:bg-panel transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
          </svg>
          Start work
        </button>
        <button
          onClick={() => setShowSearch((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded text-sm text-text-sub hover:text-text hover:bg-panel transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          Search history
        </button>
      </div>

      {/* Search input */}
      {showSearch && (
        <div className="px-3 pb-2">
          <input
            autoFocus
            placeholder="Search by title or content..."
            className="w-full bg-panel border border-border rounded px-3 py-2 text-sm text-text placeholder-text-muted outline-none focus:border-primary/50 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setShowSearch(false);
                setSearchQuery('');
              }
            }}
          />
          {searchQuery && searchResults.length > 0 && (
            <div className="mt-1 border border-border rounded bg-panel py-1">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    dispatch({ type: 'SET_ACTIVE_CONV', id: c.id });
                    setShowSearch(false);
                    setSearchQuery('');
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-text-sub hover:text-text hover:bg-panel-raised transition-colors"
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}
          {searchQuery && searchResults.length === 0 && (
            <p className="mt-1 px-1 text-xs text-text-muted">No history found</p>
          )}
        </div>
      )}

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 min-h-0">
        {pinned.length > 0 && (
          <div className="mb-1">
            <p className="px-3 py-1 text-xs font-medium text-text-dim uppercase tracking-wider">
              Pinned
            </p>
            {pinned.map((c) => (
              <ConvItem key={c.id} conv={c} isActive={state.activeConversationId === c.id} />
            ))}
          </div>
        )}
        {recent.length > 0 && (
          <div className="mb-1">
            {pinned.length > 0 && (
              <p className="px-3 py-1 text-xs font-medium text-text-dim uppercase tracking-wider">
                Recent
              </p>
            )}
            {recent.map((c) => (
              <ConvItem key={c.id} conv={c} isActive={state.activeConversationId === c.id} />
            ))}
          </div>
        )}
        {visibleConvs.length === 0 && (
          <p className="px-3 py-2 text-xs text-text-muted">No work history yet</p>
        )}

        {/* Archived section */}
        {archivedConvs.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1.5 w-full px-3 py-1 text-xs font-medium text-text-dim uppercase tracking-wider hover:text-text-muted transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showArchived ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Archived
              <span className="ml-auto text-text-dim font-mono">{archivedConvs.length}</span>
            </button>
            {showArchived && archivedConvs.map((c) => (
              <ArchivedConvItem key={c.id} conv={c} isActive={state.activeConversationId === c.id} />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border-dim mx-3 my-2" />

      {/* Nav items */}
      <nav className="px-2 pb-2 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            state.activeConversationId === null &&
            state.activeWorkerId === null &&
            state.activeJobId === null &&
            state.activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                dispatch({ type: 'SET_VIEW', view: item.id as any });
                if (onCloseMobile) onCloseMobile();
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-panel-raised text-text'
                  : 'text-text-sub hover:bg-panel hover:text-text'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {'badge' in item && item.badge ? (
                <span className="text-xs bg-danger text-white rounded-full px-1.5 py-0.5 font-mono font-medium">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}

        <button
          onClick={() => {
            dispatch({ type: 'SET_SHOW_CREATE', show: true });
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-text-sub hover:bg-panel hover:text-text transition-colors mt-1"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
          </svg>
          Create
        </button>
      </nav>

      {/* Divider */}
      {isAuthenticated && <div className="border-t border-border-dim mx-3 mb-2" />}

      {/* Secondary nav (auth only) */}
      {isAuthenticated && (
        <nav className="px-2 pb-2 flex flex-col gap-0.5">
          {[
            { id: 'security', label: 'Security & Authority', icon: SecurityIcon },
            { id: 'billing', label: 'Billing & Usage', icon: BillingIcon },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = state.activeConversationId === null && state.activeWorkerId === null && state.activeJobId === null && state.activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => dispatch({ type: 'SET_VIEW', view: item.id as any })}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded text-xs transition-colors ${
                  isActive ? 'bg-panel-raised text-text' : 'text-text-muted hover:text-text hover:bg-panel'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Account / Footer */}
      <div className="border-t border-border-dim mx-3 mb-0" />
      <div className="px-3 py-3">
        {isAuthenticated ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary-dim flex items-center justify-center text-xs font-medium text-primary shrink-0">
              {state.user!.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text truncate">{state.user!.name}</p>
              <p className="text-xs text-text-muted truncate">{state.user!.email}</p>
            </div>
            <button
              onClick={() => dispatch({ type: 'SET_USER', user: null })}
              className="text-text-muted hover:text-text-sub p-1 rounded transition-colors"
              title="Sign out"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() =>
              dispatch({
                type: 'SET_IDENTITY_CHECKPOINT',
                checkpoint: {
                  reason: 'sign-in',
                  feature: 'your account',
                  onComplete: (user) => dispatch({ type: 'SET_USER', user }),
                },
              })
            }
            className="w-full text-left flex items-center gap-2.5 px-1 py-1 rounded text-sm text-text-muted hover:text-text transition-colors"
          >
            <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <span>Guest</span>
            <span className="ml-auto text-xs text-primary">Sign in</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Inline icon components ────────────────────────────────────────────────────

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 21V12h6v9" />
    </svg>
  );
}

function DiscoverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeWidth={1.8} d="M16.24 7.76l-4.24 2.83-2.83 4.24 4.24-2.83 2.83-4.24z" />
    </svg>
  );
}

function WorkersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="3" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeWidth={1.8} d="M3 20a6 6 0 0112 0" />
      <path strokeLinecap="round" strokeWidth={1.8} d="M18 9l2 2 4-4" />
    </svg>
  );
}

function RoutinesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function WalletsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2v-6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 12V7a1 1 0 00-1-1H4" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SecurityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeWidth={1.8} d="M2 10h20" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" />
      <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
    </svg>
  );
}
