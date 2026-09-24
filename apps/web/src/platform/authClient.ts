import { createAuthClient } from 'better-auth/react';
import { siweClient } from 'better-auth/client/plugins';
import { WEB_RUNTIME_SETTINGS } from './runtime';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export const authClient = createAuthClient({
  baseURL: WEB_RUNTIME_SETTINGS.authBaseUrl || (typeof window !== 'undefined' ? window.location.origin : undefined),
  fetchOptions: { credentials: 'include' },
  plugins: [siweClient()],
});

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const { data } = await authClient.getSession();
  if (!data?.user) return null;
  return {
    id: data.user.id,
    name: data.user.name || 'AgentPlace user',
    email: data.user.email || '',
    image: data.user.image ?? null,
  };
}

function displayEmail(email: string): string {
  return email.endsWith('@siwe.placeholder.invalid') ? 'Wallet identity' : email;
}

export async function getAgentPlaceIdentity(): Promise<AuthenticatedUser> {
  const response = await fetch(`${WEB_RUNTIME_SETTINGS.apiBaseUrl}/api/v1/me`, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('AgentPlace could not load your signed-in identity.');
  const payload = await response.json() as {
    user?: { appUserId?: string; name?: string; email?: string; image?: string | null };
  };
  const user = payload.user;
  if (!user?.appUserId) throw new Error('AgentPlace returned an invalid signed-in identity.');
  return {
    id: user.appUserId,
    name: user.name || 'AgentPlace user',
    email: displayEmail(user.email || ''),
    image: user.image ?? null,
  };
}

export async function signOut(): Promise<void> {
  await authClient.signOut();
}

export async function signInWithGoogle(): Promise<AuthenticatedUser> {
  const popup = window.open('', 'agentplace-google-auth', 'width=520,height=720,menubar=no,toolbar=no,location=yes,resizable=yes,scrollbars=yes');
  if (!popup) throw new Error('Your browser blocked the Google sign-in window. Allow pop-ups for AgentPlace and try again.');
  popup.document.title = 'AgentPlace · Google sign-in';
  popup.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px;color:#555">Opening Google sign-in…</p>';

  try {
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL: window.location.href,
      disableRedirect: true,
    });
    const url = (result.data as { url?: string } | null)?.url;
    if (!url) throw new Error(result.error?.message || 'Google sign-in could not be started.');
    popup.location.href = url;

    const deadline = Date.now() + 2 * 60 * 1000;
    while (Date.now() < deadline) {
      if (popup.closed) throw new Error('Google sign-in was cancelled.');
      await new Promise((resolve) => setTimeout(resolve, 750));
      const user = await getAuthenticatedUser().catch(() => null);
      if (user) {
        popup.close();
        return user;
      }
    }
    popup.close();
    throw new Error('Google sign-in timed out. Please try again.');
  } catch (error) {
    if (!popup.closed) popup.close();
    throw error;
  }
}

function ethereumProvider(): EthereumProvider {
  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!provider) throw new Error('No Ethereum wallet extension was detected.');
  return provider;
}

function siweMessage(input: {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
}): string {
  const issuedAt = new Date();
  const expiration = new Date(issuedAt.getTime() + 5 * 60 * 1000);
  return `${input.domain} wants you to sign in with your Ethereum account:\n${input.address}\n\nSign in to AgentPlace. This proves wallet control only and does not grant transaction authority.\n\nURI: ${input.uri}\nVersion: 1\nChain ID: ${input.chainId}\nNonce: ${input.nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiration.toISOString()}`;
}

export async function signInWithEthereum(): Promise<AuthenticatedUser> {
  const provider = ethereumProvider();
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  const address = accounts[0];
  if (!address) throw new Error('The wallet did not provide an account.');
  const chainHex = (await provider.request({ method: 'eth_chainId' })) as string;
  const chainId = Number.parseInt(chainHex, 16);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new Error('The wallet returned an invalid chain ID.');

  const nonceResult = await authClient.siwe.nonce();
  if (nonceResult.error || !nonceResult.data?.nonce) throw new Error(nonceResult.error?.message || 'Could not create a secure sign-in nonce.');

  const publicOrigin = window.location.origin;
  const domain = window.location.hostname;
  const message = siweMessage({ domain, address, uri: publicOrigin, chainId, nonce: nonceResult.data.nonce });
  const signature = (await provider.request({ method: 'personal_sign', params: [message, address] })) as string;
  const result = await authClient.siwe.verify({ message, signature });
  if (result.error) throw new Error(result.error.message || 'Wallet sign-in failed.');

  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Wallet signature was accepted but no AgentPlace session was created.');
  return user;
}
