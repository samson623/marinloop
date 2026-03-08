# MarinLoop

MarinLoop is a pre-release beta medication adherence and daily care application for the medical community. It enables patients and caregivers to track medications, log doses, review adherence trends, and receive scheduled push notifications for reminders and refills. AI-assisted features — including prescription label extraction from photos and a medication tracking assistant — are gated behind explicit user consent and run server-side only, never in the browser. The app is a Progressive Web App (PWA) installable on iOS and Android.

**Stack:** React 19 · TypeScript · Vite 7 · Supabase · Tailwind CSS v4 · Zustand · React Query · PWA

---

## Architecture

- **Frontend:** React 19 SPA with React Router v7, deployed as a PWA on Vercel. Vite build with TypeScript strict mode. Sentry integrated with PII scrubbing before events are sent.
- **Backend:** Supabase — PostgreSQL with Row Level Security, Supabase Auth (email + Google OAuth), and Supabase Edge Functions (Deno runtime).
- **AI:** All OpenAI calls are made exclusively from Supabase Edge Functions (`openai-chat`, `extract-label`). The API key is never exposed to the client. AI features require explicit per-user consent stored in the database.
- **Push Notifications:** Web Push via VAPID. The `send-push` Edge Function delivers notifications; `cron-dispatch-push` is triggered by a `pg_cron` job to dispatch scheduled reminders automatically.
- **External APIs:** NIH RxNav and OpenFDA are called client-side for drug reference lookups (drug interactions, allergy checks). No PHI is transmitted to these services.
- **Hosting:** Vercel (Vite framework preset). SPA rewrites and security headers configured in `vercel.json`.

---

## Quick Start

### Prerequisites

- Node.js 20 or later
- A Supabase project (free tier is sufficient for development)
- An OpenAI API key (required for AI features; not required to run the app without them)

### 1. Clone & Install

```bash
git clone <repo-url>
cd marinloop
npm install
cp .env.example .env
```

### 2. Environment Variables

Edit `.env` and fill in the values below. See the [Environment Variables Reference](#environment-variables-reference) for full descriptions.

```bash
VITE_APP_MODE=prod
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
VITE_OAUTH_REDIRECT_URL=http://localhost:5173/auth/callback   # local dev only
VITE_VAPID_PUBLIC_KEY=<public-key-from-step-5>
```

`VITE_OPENAI_MODEL` is optional and display-only — the model is enforced server-side.

### 3. Apply Database Migrations

**Option A — Supabase CLI (recommended):**
```bash
supabase db push
```

**Option B — Dashboard (no CLI):** Open Supabase Dashboard → SQL Editor and run in order:
1. `supabase/schema.sql` (base schema)
2. `supabase/run-migrations.sql` (migrations 001 onward)

Then run `supabase/setup-push.sql` to configure the `pg_cron` push dispatcher. Edit the `\set SERVICE_ROLE_KEY` line with your actual service role key (Dashboard → Settings → API → service_role) before running it. Without this, the cron dispatcher will be unable to invoke `cron-dispatch-push` and no push notifications will be sent automatically.

### 4. Set Supabase Secrets

Set all server-side secrets before deploying Edge Functions:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
supabase secrets set ALLOWED_ORIGINS=https://your-app-domain.com,http://localhost:5173
supabase secrets set AI_DAILY_LIMIT=50
supabase secrets set VAPID_PUBLIC_KEY=<your-vapid-public-key>
supabase secrets set VAPID_PRIVATE_KEY=<your-vapid-private-key>
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

See the [Supabase Secrets Reference](#supabase-secrets-reference) for descriptions of each secret.

### 5. Configure VAPID Keys

VAPID keys authenticate your server with browser push services. Generate them once:

```bash
npx web-push generate-vapid-keys
```

This outputs a public key and a private key. Place each key as follows:

| Key | Destination |
|-----|-------------|
| Public key | `.env` as `VITE_VAPID_PUBLIC_KEY` **and** Supabase secret `VAPID_PUBLIC_KEY` |
| Private key | Supabase secret `VAPID_PRIVATE_KEY` only — never in `.env` or client code |

Additionally, store the Supabase project URL and service role key in the Postgres Vault so the database cron job can invoke `cron-dispatch-push`:

```sql
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT vault.create_secret('https://<your-project-ref>.supabase.co', 'supabase_url', 'Supabase URL for Cron');
SELECT vault.create_secret('<your-service-role-key>', 'service_role_key', 'Service Role Key for Cron');
```

Run this in Dashboard → SQL Editor.

### 6. Deploy Edge Functions

```bash
npm run deploy:functions
```

Or deploy individually:

| Function | npm script | Description |
|----------|-----------|-------------|
| `openai-chat` | `npm run deploy:openai-chat` | AI medication assistant; requires `OPENAI_API_KEY`, `ALLOWED_ORIGINS` |
| `extract-label` | `npm run deploy:extract-label` | Prescription label extraction from images; shares `AI_DAILY_LIMIT` with `openai-chat` |
| `send-push` | `npm run deploy:send-push` | Web Push delivery; requires VAPID secrets |
| `cron-dispatch-push` | `npm run deploy:cron-dispatch-push` | Cron-triggered push dispatcher; requires Vault entries from step 5 |

All deploy scripts require `SUPABASE_PROJECT_REF` to be set in your environment, or you can run `npx supabase login` and deploy directly with the Supabase CLI.

After changing `ALLOWED_ORIGINS` in Supabase secrets, redeploy the affected functions for the change to take effect.

### 7. Configure Google OAuth

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** Your app URL (e.g. `https://marinloop.com` or `http://localhost:5173` for local dev)
- **Redirect URLs:** Add the exact callback URL for each environment:
  - Production: `https://marinloop.com/auth/callback`
  - Local dev: `http://localhost:5173/auth/callback`
  - Vercel preview: `https://<your-preview-slug>.vercel.app/auth/callback`

In Google Cloud Console, set the OAuth redirect URI to `https://<your-project-ref>.supabase.co/auth/v1/callback`.

### 8. Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables Reference

These are client-side variables set in `.env` locally and in the Vercel project dashboard for production.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APP_MODE` | Yes | `demo` or `prod`. Controls demo data vs. live Supabase backend. |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL (Dashboard → Project Settings → API → Project URL). |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key. Safe to expose in client bundles. |
| `VITE_OAUTH_REDIRECT_URL` | No | OAuth callback URL override. Defaults to `window.location.origin + /auth/callback`. Set to `http://localhost:5173/auth/callback` for local dev. |
| `VITE_VAPID_PUBLIC_KEY` | Yes | VAPID public key for Web Push subscription. Generated with `npx web-push generate-vapid-keys`. |
| `VITE_OPENAI_MODEL` | No | Display-only label for the AI model name shown in the UI. The actual model is configured server-side in the Edge Function. |

**`OPENAI_API_KEY` is never set in `.env`.** It lives exclusively in Supabase secrets.

---

## Supabase Secrets Reference

These are server-side secrets set via `supabase secrets set` or the Supabase Dashboard (Project Settings → Edge Functions → Secrets). They are never exposed to the client.

| Secret | Required | Description |
|--------|----------|-------------|
| `OPENAI_API_KEY` | Yes (AI features) | OpenAI API key. Used by `openai-chat` and `extract-label`. |
| `ALLOWED_ORIGINS` | Yes (production) | Comma-separated list of allowed CORS origins for AI Edge Functions. Fail-closed: if unset, all cross-origin requests are rejected with 403. Example: `https://marinloop.com,http://localhost:5173`. |
| `AI_DAILY_LIMIT` | No | Maximum AI requests (chat + label extraction combined) per user per UTC calendar day. Default: `50`. Exceeded requests return 429 with `Retry-After` and `X-RateLimit-*` headers. |
| `VAPID_PUBLIC_KEY` | Yes (push) | VAPID public key. Must match `VITE_VAPID_PUBLIC_KEY` in client env. |
| `VAPID_PRIVATE_KEY` | Yes (push) | VAPID private key. Never set on the client side. |
| `VAPID_SUBJECT` | Yes (push) | Contact identifier for the push service. Use `mailto:you@example.com`. |

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `profiles` | User profile data and AI consent state |
| `medications` | Medication records per user |
| `schedules` | Dosing schedules linked to medications |
| `dose_logs` | Per-dose adherence log |
| `appointments` | Appointment tracking |
| `notes` | Free-text notes |
| `refills` | Refill tracking and reminders |
| `notifications` | In-app notification records |
| `push_subscriptions` | Web Push endpoint subscriptions per device |
| `ai_conversations` | AI chat history per user |
| `ai_daily_usage` | Per-user rate limit counter for AI chat and label extraction |

For full schema details, see `supabase/DATABASE_SETUP.md`.

---

## Troubleshooting

### App works on Vercel but not locally

Vercel injects environment variables from its project dashboard. Locally, they must exist in a `.env` file.

1. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as in Vercel).
2. In Supabase Dashboard → Authentication → URL Configuration → Redirect URLs, add `http://localhost:5173/auth/callback`. Without this, OAuth will succeed on Vercel but the local callback will be rejected.
3. After editing `.env`, restart the dev server (`Ctrl+C`, then `npm run dev`) so Vite picks up the new variables.

### Label extraction shows "Could not reach the server"

The `extract-label` Edge Function is rejecting the request due to CORS. The requesting origin is not in `ALLOWED_ORIGINS`.

1. Add all origins users can access the app from:
   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://marinloop.com,https://<preview-slug>.vercel.app,http://localhost:5173
   ```
2. Redeploy the function to pick up the updated secret:
   ```bash
   supabase functions deploy extract-label --project-ref <your-project-ref>
   ```

### Push notifications not working

1. Confirm that `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` are set in Supabase secrets and match the public key in `VITE_VAPID_PUBLIC_KEY`.
2. Confirm that the Postgres Vault contains `supabase_url` and `service_role_key` entries (see step 5 of Quick Start).
3. Confirm `send-push` and `cron-dispatch-push` are deployed.
4. Run `supabase/diagnose-push.sql` in the SQL Editor to identify the exact failure point in the cron dispatcher chain.

### Google OAuth redirect errors

Ensure the Supabase redirect URL allowlist includes the exact callback URL for the environment where the error occurs (see step 7 of Quick Start). A mismatch between the registered URL and the URL the app redirects to will produce an error from Supabase or Google. Vercel preview deployments each have a unique hostname and must be added individually, or use a wildcard redirect pattern if your Supabase plan supports it.

---

## Development

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Vite dev server at `http://localhost:5173` |
| Build | `npm run build` | TypeScript compile + Vite production build to `dist/` |
| Type check | `npm run typecheck` | Run `tsc -b` without emitting files |
| Lint | `npm run lint` | ESLint 9.x with typescript-eslint and react-hooks plugin |
| Unit tests | `npm test` | Vitest (run once) |
| Unit tests (watch) | `npm run test:watch` | Vitest in watch mode |
| E2E tests | `npm run test:e2e` | Playwright |
| Preview build | `npm run preview` | Serve the production build locally |

---

## Secrets Handling

- Keep runtime secrets in provider secret stores (Supabase secrets, Vercel environment variables, GitHub Actions secrets). Never commit them to the repository.
- Use `.env` only for local development. The file is gitignored and must never be committed.
- Use sanitized placeholders when documenting setup (see `docs/templates/supabase-secrets-export.template.txt`).
- Never paste service-role keys, API keys, tokens, or vault exports into pull requests, issues, or commit messages.

---

## Legal

MarinLoop is pre-release beta software provided for informational purposes only. It is not a medical device, does not provide clinical advice, and is not a HIPAA-covered entity. AI-assisted features are informational tools only and do not constitute medical recommendations. Full terms of service and privacy policy are available in-app.
