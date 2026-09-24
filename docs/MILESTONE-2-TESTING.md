# Production Milestone 2 — User Test Checklist

For the production Railway/Vercel configuration, see `MILESTONE-2-DEPLOYMENT.md`.

## 1. Install and migrate

After copying `.env.example` to `.env`, configure `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Google variables are optional; wallet sign-in remains available without them. For local testing against Railway Postgres, prefer a Railway CLI tunnel instead of exposing the database publicly.

Run:

```powershell
pnpm install --no-frozen-lockfile
pnpm migrate
pnpm check
pnpm dev
```

Expected: migrations create the AgentPlace conversation tables plus Better Auth's `auth` schema/tables, including its database-backed rate-limit table. `pnpm check` ends with both Milestone 1 and Milestone 2 verification passing.

## 2. Guest continuity

Open `http://localhost:5173` in a private browser window. Start a research conversation without signing in, rename it and refresh.

Expected: guest work remains available on that browser. It is temporary/local state, not PostgreSQL-backed account history yet.

## 3. Wallet sign-in

From a persistence-gated action in the current conversation, choose **Continue with wallet** and sign the SIWE message in an injected EVM wallet.

Expected: no blockchain transaction is requested, no gas is spent, and the UI explicitly says the signature is identity-only. The originating conversation is migrated to the authenticated account and remains open.

## 4. Google sign-in (optional)

Configure Google OAuth credentials and choose **Continue with Google**.

Expected: Google opens in a separate sign-in window. The AgentPlace page and its in-memory continuation remain intact; after successful authentication the window closes and the original flow continues.

## 5. Durable conversations

While signed in:

- create a conversation;
- send messages;
- rename it;
- pin it;
- archive and unarchive it;
- refresh the browser;
- sign out, then sign back in;
- optionally open AgentPlace in a second browser with the same identity.

Expected: the conversation and its durable changes return from PostgreSQL. A manually renamed title is not overwritten by later auto-title attempts.

## 6. Search

Create conversations containing distinct terms. Search by title, exact message content and a close/fuzzy spelling.

Expected: authenticated search uses the server/PostgreSQL result set. This milestone does not claim embedding-based semantic retrieval.

## 7. Isolation

Use a different Google/wallet identity and try normal navigation/search.

Expected: the second identity cannot see the first identity's conversations. Knowing another conversation ID must not grant access.

## 8. Sign-out privacy

Sign out after viewing authenticated history.

Expected: AgentPlace returns to Guest state and does not leave the authenticated conversation collection as authoritative local fixture state.

## 9. Safety

Open `/api/v1/config` through the web origin.

Expected: auth capability flags are truthful and Mainnet execution/autonomy remain disabled by default. No Milestone 2 flow should ask to send an onchain transaction.
