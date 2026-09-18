import type { ActiveCreatorSurface, AppState, NavView } from '../state/types';

export interface RouteSelection {
  activeView: NavView;
  activeConversationId: string | null;
  activeWorkerId: string | null;
  activeJobId: string | null;
  activeWalletId: string | null;
  activeRoutineId: string | null;
  activeCreatorSurface: ActiveCreatorSurface;
  activeDiscoverItemId: string | null;
  showCreateMenu: boolean;
  routeNotFound: string | null;
}

function baseSelection(activeView: NavView): RouteSelection {
  return {
    activeView,
    activeConversationId: null,
    activeWorkerId: null,
    activeJobId: null,
    activeWalletId: null,
    activeRoutineId: null,
    activeCreatorSurface: null,
    activeDiscoverItemId: null,
    showCreateMenu: false,
    routeNotFound: null,
  };
}

function decoded(segment: string | undefined): string | null {
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function routeSelectionFromPath(pathname: string): RouteSelection {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const segments = clean.split('/').filter(Boolean);

  if (clean === '/') return baseSelection('home');
  if (clean === '/discover') return baseSelection('discover');
  if (clean === '/workers') return baseSelection('workers');
  if (clean === '/routines') return baseSelection('routines');
  if (clean === '/activity') return baseSelection('activity');
  if (clean === '/wallets') return baseSelection('wallets');
  if (clean === '/security') return baseSelection('security');
  if (clean === '/billing') return baseSelection('billing');
  if (clean === '/settings') return baseSelection('settings');

  if (segments[0] === 'conversations' && segments.length === 2) {
    const id = decoded(segments[1]);
    if (id) return { ...baseSelection('home'), activeConversationId: id };
  }
  if (segments[0] === 'discover' && segments.length === 2) {
    const id = decoded(segments[1]);
    if (id) return { ...baseSelection('discover'), activeDiscoverItemId: id };
  }
  if (segments[0] === 'workers' && segments.length === 2) {
    const id = decoded(segments[1]);
    if (id) return { ...baseSelection('workers'), activeWorkerId: id };
  }
  if (segments[0] === 'routines' && segments.length === 2) {
    const id = decoded(segments[1]);
    if (id) return { ...baseSelection('routines'), activeRoutineId: id };
  }
  if (segments[0] === 'wallets' && segments.length === 2) {
    const id = decoded(segments[1]);
    if (id) return { ...baseSelection('wallets'), activeWalletId: id };
  }
  if (segments[0] === 'activity' && segments[1] === 'jobs' && segments.length === 3) {
    const id = decoded(segments[2]);
    if (id) return { ...baseSelection('activity'), activeJobId: id };
  }
  if (clean === '/create') {
    return { ...baseSelection('home'), showCreateMenu: true };
  }
  if (segments[0] === 'create' && segments.length === 2) {
    const surfaceByPath: Record<string, ActiveCreatorSurface> = {
      worker: 'agent-builder',
      workflow: 'workflow-studio',
      capability: 'capability-studio',
      creations: 'creator-home',
    };
    const surface = surfaceByPath[segments[1] ?? ''];
    if (surface) return { ...baseSelection('home'), activeCreatorSurface: surface };
  }

  return { ...baseSelection('home'), routeNotFound: pathname };
}

export function applyRouteSelection(state: AppState, route: RouteSelection): AppState {
  return {
    ...state,
    ...route,
    activeActionId: null,
    activeReceiptId: null,
    notificationInboxOpen: false,
    mobileDrawerOpen: false,
    showSearch: false,
    identityCheckpoint: null,
  };
}

function encoded(value: string): string {
  return encodeURIComponent(value);
}

export function pathForState(state: AppState): string {
  if (state.routeNotFound) return state.routeNotFound;
  if (state.activeJobId) return `/activity/jobs/${encoded(state.activeJobId)}`;
  if (state.activeRoutineId) return `/routines/${encoded(state.activeRoutineId)}`;
  if (state.activeCreatorSurface) {
    const pathBySurface: Record<Exclude<ActiveCreatorSurface, null>, string> = {
      'agent-builder': '/create/worker',
      'workflow-studio': '/create/workflow',
      'capability-studio': '/create/capability',
      'creator-home': '/create/creations',
    };
    return pathBySurface[state.activeCreatorSurface];
  }
  if (state.activeDiscoverItemId) return `/discover/${encoded(state.activeDiscoverItemId)}`;
  if (state.activeWorkerId) return `/workers/${encoded(state.activeWorkerId)}`;
  if (state.activeConversationId) return `/conversations/${encoded(state.activeConversationId)}`;
  if (state.activeView === 'wallets' && state.activeWalletId) {
    return `/wallets/${encoded(state.activeWalletId)}`;
  }
  if (state.showCreateMenu) return '/create';

  const viewPath: Record<NavView, string> = {
    home: '/',
    discover: '/discover',
    workers: '/workers',
    routines: '/routines',
    activity: '/activity',
    wallets: '/wallets',
    security: '/security',
    billing: '/billing',
    settings: '/settings',
  };
  return viewPath[state.activeView];
}

export function isNavigationAction(type: string): boolean {
  return [
    'SET_VIEW',
    'ADD_CONV',
    'SET_ACTIVE_CONV',
    'SET_ACTIVE_WORKER',
    'SET_ACTIVE_JOB',
    'SET_ACTIVE_WALLET',
    'SET_ACTIVE_ROUTINE',
    'SET_ACTIVE_DISCOVER_ITEM',
    'SET_CREATOR_SURFACE',
    'SET_SHOW_CREATE',
    'RESET_GUEST',
    'RESET_ACTIVE',
  ].includes(type);
}
