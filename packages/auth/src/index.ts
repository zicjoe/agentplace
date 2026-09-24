import { randomBytes } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node';
import type { IncomingHttpHeaders } from 'node:http';
import { siwe } from 'better-auth/plugins';
import { PostgresDialect } from 'kysely';
import { verifyMessage } from 'viem';
import { getDatabasePool } from '@agent-place/db';

export const moduleManifest = {
  name: 'auth',
  layer: 'trusted-core',
  milestone: 2,
  status: 'production-foundation',
} as const;

export interface AuthAvailability {
  readonly configured: boolean;
  readonly google: boolean;
  readonly ethereumWallet: boolean;
}

export interface AgentPlaceIdentity {
  readonly authUserId: string;
  readonly appUserId: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
}

function requireValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for AgentPlace authentication.`);
  return value;
}

function origins(): string[] {
  return (process.env.AUTH_TRUSTED_ORIGINS ?? process.env.WEB_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getAuthAvailability(): AuthAvailability {
  const configured = Boolean(process.env.BETTER_AUTH_SECRET?.trim() && process.env.BETTER_AUTH_URL?.trim() && process.env.DATABASE_URL?.trim());
  return {
    configured,
    google: configured && Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()),
    ethereumWallet: configured,
  };
}

type AgentPlaceAuth = ReturnType<typeof betterAuth>;

function createAuth(): AgentPlaceAuth {
  const secret = requireValue('BETTER_AUTH_SECRET');
  if (secret.length < 32 || secret.includes('replace-with')) throw new Error('BETTER_AUTH_SECRET must be a real random secret with at least 32 characters.');
  const baseURL = requireValue('BETTER_AUTH_URL');
  const domain = process.env.SIWE_DOMAIN?.trim() || new URL(baseURL).hostname;
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  return betterAuth({
    appName: 'AgentPlace',
    baseURL,
    secret,
    trustedOrigins: origins(),
    database: {
      dialect: new PostgresDialect({ pool: getDatabasePool() }),
      type: 'postgres',
      schemaName: 'auth',
    },
    socialProviders: googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
    advanced: {
      database: { joins: true },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 14,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: 'database',
    },
    plugins: [
      siwe({
        domain,
        anonymous: true,
        getNonce: async () => randomBytes(24).toString('hex'),
        verifyMessage: async ({ message, signature, address }) => {
          try {
            return await verifyMessage({
              address: address as `0x${string}`,
              message,
              signature: signature as `0x${string}`,
            });
          } catch {
            return false;
          }
        },
      }),
    ],
  }) as unknown as AgentPlaceAuth;
}

// Better Auth's plugin-specific inferred type currently captures transitive Zod
// internals in declaration emit. AgentPlace exposes only Better Auth's stable public
// instance surface from this package; SIWE remains configured on the runtime object.
let authInstance: AgentPlaceAuth | undefined;

export function getAuth(): AgentPlaceAuth {
  return authInstance ?? (authInstance = createAuth());
}

export async function requireAgentPlaceIdentity(headers: Headers): Promise<AgentPlaceIdentity> {
  const session = await getAuth().api.getSession({ headers });
  if (!session?.user) throw new Error('UNAUTHENTICATED');

  const authUser = session.user;
  const result = await getDatabasePool().query<{
    id: string;
    display_name: string | null;
    email: string | null;
    image_url: string | null;
  }>(
    `INSERT INTO app_user (external_subject, display_name, email, image_url, last_seen_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (external_subject) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       email = EXCLUDED.email,
       image_url = EXCLUDED.image_url,
       last_seen_at = now(),
       updated_at = now()
     RETURNING id, display_name, email, image_url`,
    [authUser.id, authUser.name ?? null, authUser.email ?? null, authUser.image ?? null],
  );
  const appUser = result.rows[0];
  if (!appUser) throw new Error('IDENTITY_SYNC_FAILED');

  return {
    authUserId: authUser.id,
    appUserId: appUser.id,
    name: appUser.display_name || authUser.name || 'AgentPlace user',
    email: appUser.email || authUser.email || '',
    image: appUser.image_url,
  };
}

export function getAuthNodeHandler(): ReturnType<typeof toNodeHandler> {
  return toNodeHandler(getAuth());
}

export function toAuthHeaders(headers: IncomingHttpHeaders): Headers {
  return fromNodeHeaders(headers);
}
