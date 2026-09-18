import { useState } from 'react';
import { useAppState, useDispatch } from '../state/AppContext';
import type { User } from '../state/types';

const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Chen',
  email: 'alex@example.com',
  initials: 'AC',
};

export function IdentityCheckpoint() {
  const state = useAppState();
  const dispatch = useDispatch();
  const [step, setStep] = useState<'choose' | 'form'>('choose');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const checkpoint = state.identityCheckpoint;
  if (!checkpoint) return null;

  function dismiss() {
    dispatch({ type: 'SET_IDENTITY_CHECKPOINT', checkpoint: null });
  }

  function completeSignIn(user: User) {
    dispatch({ type: 'SET_USER', user });
    checkpoint!.onComplete(user);
    dispatch({ type: 'SET_IDENTITY_CHECKPOINT', checkpoint: null });
  }

  function handleMockSignIn() {
    const user: User = {
      id: 'u1',
      name: name.trim() || MOCK_USER.name,
      email: email.trim() || MOCK_USER.email,
      initials: name.trim()
        ? name.trim().split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
        : MOCK_USER.initials,
    };
    completeSignIn(user);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="w-full max-w-md bg-panel border border-border rounded-xl shadow-2xl">
        {step === 'choose' && (
          <>
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-primary-dim rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text">Account needed</h2>
                  <p className="text-xs text-text-sub">to {checkpoint.feature}</p>
                </div>
              </div>

              <p className="text-sm text-text-sub leading-relaxed mb-5">
                This requires an AgentPlace account. Your current session and conversation
                context will be preserved.
              </p>

              <div className="space-y-2 mb-5">
                {[
                  'Conversations saved across devices',
                  'Workers run in the background',
                  'Routines and monitoring',
                  'Notifications when things need you',
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2.5">
                    <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs text-text-sub">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setStep('form')}
                  className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Create account
                </button>
                <button
                  onClick={() => setStep('form')}
                  className="w-full py-2.5 border border-border text-text-sub text-sm rounded-lg hover:bg-panel-raised hover:text-text transition-colors"
                >
                  Sign in
                </button>
              </div>
            </div>

            <div className="border-t border-border-dim px-6 py-4">
              <p className="text-xs text-text-muted text-center">
                Account ≠ wallet connection. Signing in does not grant any execution authority.
              </p>
            </div>

            <div className="border-t border-border-dim px-6 py-3 flex justify-end">
              <button
                onClick={dismiss}
                className="text-xs text-text-muted hover:text-text-sub transition-colors"
              >
                Continue as Guest
              </button>
            </div>
          </>
        )}

        {step === 'form' && (
          <div className="px-6 py-6">
            <button
              onClick={() => setStep('choose')}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-sub mb-5 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
              Back
            </button>

            <h2 className="text-base font-semibold text-text mb-1">Sign in</h2>
            <p className="text-xs text-text-muted mb-5">
              This is a prototype — no real authentication. Enter any name and email.
            </p>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-medium text-text-sub block mb-1">Name</label>
                <input
                  className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted outline-none focus:border-primary/50 transition-colors"
                  placeholder="Alex Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-text-sub block mb-1">Email</label>
                <input
                  type="email"
                  className="w-full bg-panel-raised border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted outline-none focus:border-primary/50 transition-colors"
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMockSignIn();
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleMockSignIn}
              className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
            >
              Continue
            </button>

            <button
              onClick={dismiss}
              className="w-full mt-2 py-2.5 text-text-muted text-sm hover:text-text-sub transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
