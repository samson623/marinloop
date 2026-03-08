# MarinLoop

**Medication adherence and daily care, simplified.**

[![CI](https://github.com/samson623/marinloop/actions/workflows/ci.yml/badge.svg)](https://github.com/samson623/marinloop/actions/workflows/ci.yml)
[![Coverage](https://codecov.io/gh/samson623/marinloop/branch/main/graph/badge.svg)](https://codecov.io/gh/samson623/marinloop)

MarinLoop helps patients and caregivers stay on top of medications, appointments, and health trends — without the complexity of traditional EHR portals. It is a privacy-first Progressive Web App installable on iOS and Android, built for people who manage daily medication routines and the caregivers who support them.

**Live app:** [https://marinloop.com](https://marinloop.com) · **Status:** Pre-release beta

![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)

---

## Why MarinLoop

Managing medications across multiple prescriptions, refill dates, and care providers is error-prone and stressful. Missed doses lead to worse outcomes. Caregivers often have no visibility into whether their loved ones are staying on track.

MarinLoop solves this by putting medication tracking, adherence history, and caregiver coordination into a single lightweight app that works offline and sends timely push reminders — no app store download required.

---

## Key Features

- **Medication management** — Add medications manually or scan a prescription label with AI-powered extraction. Track dosing schedules, refill dates, and inventory.
- **Dose logging & adherence** — Log doses with one tap. View adherence streaks, history charts, and trend insights over time.
- **Smart reminders** — Scheduled push notifications for doses and refills, dispatched automatically via server-side cron. Works even when the app is closed.
- **Care network** — Invite caregivers to monitor adherence and receive alerts. Share an ICE (In Case of Emergency) card with QR code.
- **Health tracking** — Log vitals and symptoms alongside medications. Set threshold alerts for out-of-range readings.
- **AI assistant** — Ask questions about your medications, interactions, and schedules. All AI runs server-side with explicit opt-in consent; no data leaves your control without permission.
- **Drug safety lookups** — Real-time interaction and allergy checks via NIH RxNav and OpenFDA. No PHI transmitted.
- **Offline-first PWA** — Works without a connection. Actions queue locally and sync when back online. Installable on any device from the browser.
- **Privacy by design** — Sentry error reporting strips PII before transmission. AI consent is per-user and revocable. Row Level Security on every database table.

---

## Try It

Open [marinloop.com](https://marinloop.com), create an account, and walk through the core flows:

1. **Sign up and onboard** — accept beta terms, choose AI preferences, add to home screen
2. **Add a medication** — enter details manually or scan a label with AI
3. **Log a dose** — tap a scheduled dose on the Timeline to mark it taken
4. **Get a reminder** — enable push notifications and set a medication reminder
5. **Track your health** — log vitals, journal entries, and notes
6. **Build your care network** — add providers, caregivers, and emergency contacts
7. **Ask the AI assistant** — ask about interactions, side effects, or schedules

For the full tester guide with detailed steps, scope, and how to report issues, see **[TESTERS.md](TESTERS.md)**.

---

## Screenshots

<!-- Add your screenshots to docs/screenshots/ and uncomment the lines below -->
<!-- ![Timeline](docs/screenshots/timeline.png) -->
<!-- ![Medications](docs/screenshots/medications.png) -->
<!-- ![Reminders](docs/screenshots/reminders.png) -->
<!-- ![AI Assistant](docs/screenshots/ai-assistant.png) -->

*Screenshots coming soon — the app is in pre-release beta.*

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

## Development

| Script | Command | Description |
|--------|---------|-------------|
| Dev server | `npm run dev` | Vite dev server at `http://localhost:5173` |
| Build | `npm run build` | TypeScript compile + Vite production build to `dist/` |
| Type check | `npm run typecheck` | Run `tsc -b` without emitting files |
| Lint | `npm run lint` | ESLint 9.x with typescript-eslint and react-hooks plugin |
| Unit tests | `npm test` | Vitest (run once) |
| Unit tests (watch) | `npm run test:watch` | Vitest in watch mode |
| Coverage | `npm run test:coverage` | Vitest with V8 coverage report |
| E2E tests | `npm run test:e2e` | Playwright |
| Preview build | `npm run preview` | Serve the production build locally |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, conventions, and the pull request process.

---

## Security

See [SECURITY.md](SECURITY.md) for supported versions and responsible disclosure instructions.

---

## Secrets Handling

- Keep runtime secrets in provider secret stores (Supabase secrets, Vercel environment variables, GitHub Actions secrets). Never commit them to the repository.
- Use `.env` only for local development. The file is gitignored and must never be committed.
- Use sanitized placeholders when documenting setup (see `docs/templates/supabase-secrets-export.template.txt`).
- Never paste service-role keys, API keys, tokens, or vault exports into pull requests, issues, or commit messages.

---

## Legal

MarinLoop is pre-release beta software provided for informational purposes only. It is not a medical device, does not provide clinical advice, and is not a HIPAA-covered entity. AI-assisted features are informational tools only and do not constitute medical recommendations. Full terms of service and privacy policy are available in-app.
