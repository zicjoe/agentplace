import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { User } from '../state/types';
import { getAgentPlaceIdentity, signInWithEthereum, signInWithGoogle, type AuthenticatedUser } from '../platform/authClient';
import { fetchConversations, importGuestConversations } from '../platform/conversationApi';
import { rememberIdentityResume, clearIdentityResume } from '../platform/identityResume';
import { clearFixtureState } from '../platform/fixtureStore';
import { useRuntime } from '../platform/RuntimeProvider';

function toUser(value: AuthenticatedUser): User {
  const name = value.name || value.email.split('@')[0] || 'AgentPlace user';
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AP';
  return { id: value.id, name, email: value.email, initials };
}

export function IdentityCheckpoint() {
  const state = useAppState();
  const dispatch = useDispatch();
  const { connection, settings } = useRuntime();
  const [loading, setLoading] = useState<'google' | 'wallet' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkpoint = state.identityCheckpoint;
  if (!checkpoint) return null;

  const authConfig = connection.publicConfig?.auth;
  const authConfigured = settings.dataMode === 'api' && !!authConfig?.configured;

  function dismiss() {
    dispatch({ type: 'SET_IDENTITY_CHECKPOINT', checkpoint: null });
  }

  function rememberResume() {
    rememberIdentityResume({
      path: window.location.pathname,
      conversationId: state.activeConversationId,
      persistOriginatingConversation: checkpoint!.reason !== 'sign-in' && !!state.activeConversationId,
    });
  }

  async function finish(_value: AuthenticatedUser) {
    const guestConversation = checkpoint!.reason !== 'sign-in' && state.activeConversationId
      ? state.conversations.find((conversation) => conversation.id === state.activeConversationId)
      : undefined;
    if (guestConversation) await importGuestConversations([guestConversation]);
    const [conversations, identity] = await Promise.all([fetchConversations(), getAgentPlaceIdentity()]);
    const user = toUser(identity);
    dispatch({ type: 'SET_USER', user });
    dispatch({ type: 'SET_CONVERSATIONS', conversations });
    clearFixtureState();
    clearIdentityResume();
    checkpoint!.onComplete(user);
    dispatch({ type: 'SET_IDENTITY_CHECKPOINT', checkpoint: null });
  }

  async function authenticate(method: 'google' | 'wallet') {
    setError(null);
    setLoading(method);
    rememberResume();
    try {
      const authUser = method === 'google' ? await signInWithGoogle() : await signInWithEthereum();
      await finish(authUser);
    } catch (caught) {
      clearIdentityResume();
      setError(caught instanceof Error ? caught.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4"
      onClick={(event) => { if (event.target === event.currentTarget && !loading) dismiss(); }}
    >
      <div className="w-full max-w-md bg-panel border border-border rounded-xl shadow-2xl">
        <div className="px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-primary-dim rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-semibold text-text">Sign in to AgentPlace</h2>
              <p className="text-xs text-text-sub">to {checkpoint.feature}</p>
            </div>
          </div>

          <p className="text-sm text-text-sub leading-relaxed mb-5">
            Your current work stays in place. AgentPlace only asks for identity when persistence or an account-backed feature needs it.
          </p>

          <div className="space-y-2 mb-4">
            <button
              disabled={!authConfigured || !authConfig?.google || !!loading}
              onClick={() => void authenticate('google')}
              className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
            <button
              disabled={!authConfigured || !authConfig?.ethereumWallet || !!loading}
              onClick={() => void authenticate('wallet')}
              className="w-full py-2.5 border border-border text-text-sub text-sm rounded-lg hover:bg-panel-raised hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading === 'wallet' ? 'Waiting for wallet signature…' : 'Continue with wallet'}
            </button>
          </div>

          {!authConfigured && (
            <p className="text-xs text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2 mb-3">
              Authentication is not configured on this environment yet. Configure Railway PostgreSQL and Better Auth variables to enable sign-in.
            </p>
          )}
          {authConfigured && !authConfig?.google && (
            <p className="text-xs text-text-muted mb-2">Google sign-in is disabled until Google OAuth credentials are configured.</p>
          )}
          {error && <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="border-t border-border-dim px-6 py-4">
          <p className="text-xs text-text-muted text-center">
            Signing in with a wallet proves control only. It does not connect that wallet for execution or give AgentPlace permission to move funds.
          </p>
        </div>

        <div className="border-t border-border-dim px-6 py-3 flex justify-end">
          <button disabled={!!loading} onClick={dismiss} className="text-xs text-text-muted hover:text-text-sub transition-colors disabled:opacity-40">
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
