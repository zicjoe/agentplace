import { useState, useEffect } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { GuestHome } from './GuestHome';
import { ChatView } from './ChatView';
import { Discover } from './Discover';
import { WorkersView } from './WorkersView';
import { WorkerWorkspace } from './WorkerWorkspace';
import { JobWorkspace } from './JobWorkspace';
import { ActivityView } from './ActivityView';
import { WalletsView } from './WalletsView';
import { SecurityAuthorityView } from './SecurityAuthorityView';
import { ActionReview } from './ActionReview';
import { VerifiedReceiptView } from './VerifiedReceiptView';
import { DemoControls } from './DemoControls';
import { CreateMenu } from './CreateMenu';
import { IdentityCheckpoint } from './IdentityCheckpoint';
import { RoutinesView } from './RoutinesView';
import { RoutineWorkspace } from './RoutineWorkspace';
import { NotificationInbox } from './NotificationInbox';
import { DiscoverDetail } from './DiscoverDetail';
import { AgentBuilder } from './AgentBuilder';
import { CreatorHome } from './CreatorHome';
import { WorkflowStudio } from './WorkflowStudio';
import { CapabilityStudio } from './CapabilityStudio';
import { BillingUsageView } from './BillingUsageView';
import { WEB_RUNTIME_SETTINGS } from '../platform/runtime';

function PlaceholderView({ title, description }: { title: string; description: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-bg px-6 text-center">
      <h1 className="text-xl font-semibold text-text mb-2">{title}</h1>
      <p className="text-sm text-text-sub max-w-xs leading-relaxed">{description}</p>
      <p className="text-xs text-text-dim mt-4 font-mono">Phase 3+ feature</p>
    </div>
  );
}

function NotFoundView({ path }: { path: string }) {
  const dispatch = useDispatch();
  return (
    <div className="h-full flex flex-col items-center justify-center bg-bg px-6 text-center">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-dim mb-3">Page not found</p>
      <h1 className="text-xl font-semibold text-text mb-2">This AgentPlace route does not exist.</h1>
      <p className="text-sm text-text-sub max-w-md leading-relaxed mb-5">
        The address <span className="font-mono text-text-muted">{path}</span> is not a current AgentPlace surface.
      </p>
      <button
        onClick={() => dispatch({ type: 'SET_VIEW', view: 'home' })}
        className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        Go to Home
      </button>
    </div>
  );
}

// Priority: job > routine > creator surface > discover detail > worker > conversation > view
function MainContent() {
  const state = useAppState();

  if (state.routeNotFound) {
    return <NotFoundView path={state.routeNotFound} />;
  }
  if (state.activeJobId) {
    return <JobWorkspace />;
  }
  if (state.activeRoutineId) {
    return <RoutineWorkspace />;
  }
  if (state.activeCreatorSurface === 'agent-builder') {
    return <AgentBuilder />;
  }
  if (state.activeCreatorSurface === 'workflow-studio') {
    return <WorkflowStudio />;
  }
  if (state.activeCreatorSurface === 'capability-studio') {
    return <CapabilityStudio />;
  }
  if (state.activeCreatorSurface === 'creator-home') {
    return <CreatorHome />;
  }
  if (state.activeDiscoverItemId) {
    return <DiscoverDetail />;
  }
  if (state.activeWorkerId) {
    return <WorkerWorkspace />;
  }
  if (state.activeConversationId !== null) {
    return <ChatView />;
  }

  switch (state.activeView) {
    case 'home':
      return <GuestHome />;
    case 'discover':
      return <Discover />;
    case 'workers':
      return <WorkersView />;
    case 'activity':
      return <ActivityView />;
    case 'routines':
      return <RoutinesView />;
    case 'wallets':
      return <WalletsView />;
    case 'security':
      return <SecurityAuthorityView />;
    case 'billing':
      return <BillingUsageView />;
    case 'settings':
      return (
        <PlaceholderView
          title="Settings"
          description="Preferences and configuration."
        />
      );
    default:
      return <GuestHome />;
  }
}

export function Shell() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    function handler() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-bg text-text overflow-hidden">
        {/* Conversation / history drawer */}
        {state.mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="w-72 h-full overflow-y-auto shadow-2xl">
              <Sidebar
                isMobileDrawer
                onCloseMobile={() => dispatch({ type: 'SET_MOBILE_DRAWER', open: false })}
              />
            </div>
            <div
              className="flex-1 bg-bg/60 backdrop-blur-sm"
              onClick={() => dispatch({ type: 'SET_MOBILE_DRAWER', open: false })}
            />
          </div>
        )}

        {/* Mobile top bar */}
        <div className="h-12 bg-surface border-b border-border flex items-center px-4 shrink-0">
          <button
            onClick={() => dispatch({ type: 'SET_MOBILE_DRAWER', open: true })}
            className="text-text-muted hover:text-text p-1 -ml-1 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="mx-auto text-sm font-semibold text-text">AgentPlace</span>
          <div className="flex items-center gap-2">
            {state.user && (
              <button
                onClick={() => dispatch({ type: 'SET_NOTIFICATION_INBOX_OPEN', open: true })}
                className="relative p-1 text-text-muted hover:text-text transition-colors"
                title="Notifications"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {(state.notifications ?? []).filter((n) => !n.read).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-warn" />
                )}
              </button>
            )}
            <div
              className={`text-xs font-mono px-2 py-0.5 rounded border ${
                state.environment === 'mainnet'
                  ? 'text-accent border-accent/20'
                  : 'text-warn border-warn/20'
              }`}
            >
              {state.environment === 'mainnet' ? 'Mainnet' : 'Testnet'}
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-hidden">
          <MainContent />
        </main>

        <BottomNav />

        {state.showCreateMenu && <CreateMenu />}
        {state.identityCheckpoint && <IdentityCheckpoint />}
        {WEB_RUNTIME_SETTINGS.demoControlsEnabled && state.showDemoControls && <DemoControls />}
        {state.activeActionId && <ActionReview />}
        {state.activeReceiptId && <VerifiedReceiptView />}
        {state.notificationInboxOpen && <NotificationInbox />}
      </div>
    );
  }

  return (
    <div className="flex h-full bg-bg text-text overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        <MainContent />
      </main>
      {state.showCreateMenu && <CreateMenu />}
      {state.identityCheckpoint && <IdentityCheckpoint />}
      {WEB_RUNTIME_SETTINGS.demoControlsEnabled && state.showDemoControls && <DemoControls />}
      {state.activeActionId && <ActionReview />}
      {state.activeReceiptId && <VerifiedReceiptView />}
      {state.notificationInboxOpen && <NotificationInbox />}
    </div>
  );
}
