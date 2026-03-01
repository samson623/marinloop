# Staging Environment Setup

This guide bootstraps a separate Supabase project for staging so changes can be tested before going live.

## Overview

| | Production | Staging |
|---|---|---|
| Supabase project | `lcbdafnxwvqbziootvmi` | *(new — you create it)* |
| Vercel environment | Production | Preview |
| Triggered by | Push to `main` | Open a PR |
| Edge functions deployed | Yes (auto via CI) | Yes (auto via CI, once secrets set) |

---

## Step 1 — Create the Supabase staging project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name it something like `medflow-staging`
3. Choose the same region as production
4. Save the **project ref** (the slug in the URL, e.g. `abcdefghijklmnop`)
5. From **Project Settings → API**, copy:
   - **Project URL** (e.g. `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key
   - **service_role** key

---

## Step 2 — Apply all migrations to staging

Link the Supabase CLI to your staging project and push the schema:

```bash
npx supabase link --project-ref YOUR_STAGING_REF
npx supabase db push
```

This applies all 11 migrations (`001` through `011`) to the staging database.

If `db push` asks to reset the database, that is safe for a brand-new project.

---

## Step 3 — Generate VAPID keys for staging

Staging needs its own VAPID key pair (push subscriptions are tied to keys — reusing prod keys would mix up subscriptions).

```bash
npx web-push generate-vapid-keys
```

Save the output — you'll need both the public and private key in Steps 4 and 5.

---

## Step 4 — Add GitHub repository secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `SUPABASE_PROJECT_ID_STAGING` | staging project ref (e.g. `abcdefghijklmnop`) |
| `VAPID_PUBLIC_KEY_STAGING` | staging VAPID public key from Step 3 |
| `VAPID_PRIVATE_KEY_STAGING` | staging VAPID private key from Step 3 |
| `MEDFLOW_SERVICE_ROLE_KEY_STAGING` | staging `service_role` JWT from Step 1 |
| `ALLOWED_ORIGINS_STAGING` | `https://medflow-care-staging.vercel.app` (see Step 6) |

The following secrets are already set for production and can be shared with staging:
- `SUPABASE_ACCESS_TOKEN` — already present, used for all `supabase` CLI calls
- `VAPID_SUBJECT` — just an email/URL, can be the same
- `OPENAI_API_KEY` — same key is fine for staging

---

## Step 5 — Configure Vercel Preview environment

In the [Vercel dashboard](https://vercel.com) → **medflow-care** project → **Settings → Environment Variables**:

For each variable below, set the environment to **Preview** only (not Production):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | staging project URL from Step 1 |
| `VITE_SUPABASE_ANON_KEY` | staging anon key from Step 1 |
| `VITE_VAPID_PUBLIC_KEY` | staging VAPID public key from Step 3 |
| `VITE_APP_MODE` | `prod` |
| `VITE_OAUTH_REDIRECT_URL` | `https://medflow-care-staging.vercel.app` |
| `VITE_OPENAI_MODEL` | `gpt-5-nano` |

---

## Step 6 — Create a fixed staging alias on Vercel

Vercel preview deployments get a dynamic URL per-PR. For OAuth redirect URLs and CORS, you need a stable alias.

1. In Vercel → **medflow-care** → **Settings → Domains**
2. Add `medflow-care-staging.vercel.app` as an alias
3. Under **Git → Branches**, assign it to track the branch you use for staging (or the latest Preview)

This makes `https://medflow-care-staging.vercel.app` always point to the latest preview build.

---

## Step 7 — Configure Supabase auth for staging

In the Supabase **staging** project → **Authentication → URL Configuration**:

- **Site URL**: `https://medflow-care-staging.vercel.app`
- **Redirect URLs**: add `https://medflow-care-staging.vercel.app/**`

---

## How it works day-to-day

1. Create a branch and open a PR against `main`
2. Vercel automatically creates a preview deployment using the staging Supabase credentials
3. CI runs: typecheck → lint → test → build → deploys edge functions to the staging Supabase project
4. Test the preview URL against the staging database
5. Merge to `main` → CI deploys edge functions to production; Vercel deploys to production

---

## Secrets summary (full list)

| GitHub secret | Prod job | Staging job |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | ✅ | ✅ (shared) |
| `SUPABASE_PROJECT_ID` | ✅ | — |
| `SUPABASE_PROJECT_ID_STAGING` | — | ✅ |
| `VAPID_PUBLIC_KEY` | ✅ | — |
| `VAPID_PRIVATE_KEY` | ✅ | — |
| `VAPID_PUBLIC_KEY_STAGING` | — | ✅ |
| `VAPID_PRIVATE_KEY_STAGING` | — | ✅ |
| `VAPID_SUBJECT` | ✅ | ✅ (shared) |
| `MEDFLOW_SERVICE_ROLE_KEY` | ✅ | — |
| `MEDFLOW_SERVICE_ROLE_KEY_STAGING` | — | ✅ |
| `OPENAI_API_KEY` | ✅ | ✅ (shared) |
| `ALLOWED_ORIGINS` | ✅ | — |
| `ALLOWED_ORIGINS_STAGING` | — | ✅ |
