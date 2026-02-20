# MedFlow Care

Medication management app built with React, TypeScript, Vite, and Supabase.

---

## Quick Start / Full Setup

Follow these steps in order to get MedFlow Care running end-to-end.

### 1. Clone, install, and env copy

```bash
git clone <repo-url>
cd medflow-care
npm install
cp .env.example .env
```

### 2. Fill `.env` checklist

Edit `.env` and set:

| Variable | Where to get it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon/public key |
| `VITE_OAUTH_REDIRECT_URL` | For local dev: `http://localhost:5173` (production uses window origin) |
| `VITE_VAPID_PUBLIC_KEY` | From step 3 below (VAPID public key) |
| `VITE_OPENAI_MODEL` | Optional — display only; model is set server-side (e.g. `gpt-5-nano`) |

### 3. Generate VAPID keys (where each key goes)

Run once:

```bash
npx web-push generate-vapid-keys
```

You'll get two keys:

| Output | Goes to |
|--------|---------|
| **Public key** | `.env` as `VITE_VAPID_PUBLIC_KEY=<public-key>` |
| **Private key** | Supabase secrets (step 4), never put in `.env` |

Example:

```bash
# Output:
Public Key: BEl62iUYgUivxIkv69yViEuiBIa...
Private Key: UUxI4O8F...
```

- Put the **public** value in `.env`:
  ```env
  VITE_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa...
  ```
- Save the **private** value for Supabase secrets (next step).

### 4. Supabase secrets (backend only)

Set these in your Supabase project (Dashboard → Project Settings → Edge Functions → Secrets, or CLI):

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
supabase secrets set ALLOWED_ORIGINS=https://your-app-domain.com,https://www.your-app-domain.com
supabase secrets set VAPID_PUBLIC_KEY=your-public-key
supabase secrets set VAPID_PRIVATE_KEY=your-private-key
supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
```

- **`ALLOWED_ORIGINS`** (required for `openai-chat` in production): comma-separated list of allowed CORS origins. If unset, the API rejects all cross-origin requests (fail-closed). For local dev use e.g. `http://localhost:5173`.
- **`AI_DAILY_LIMIT`** (optional for `openai-chat`): max chat requests per user per calendar day (UTC). Default 50 if unset. Returns 429 with `Retry-After` and `X-RateLimit-*` headers when exceeded; resets at midnight UTC.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` are the same pair from step 3.
- `VAPID_SUBJECT` is a contact email for the push service (e.g. `mailto:you@example.com`).

### 5. Deploy Edge Functions

```bash
supabase functions deploy openai-chat
supabase functions deploy send-push
```

### 6. Apply migrations

**Dashboard (no CLI):** Supabase Dashboard → SQL Editor. Run in order:

1. `supabase/schema.sql` (base schema)
2. `supabase/run-migrations.sql` (001, 002, 003, 004, 005)

**CLI:** `supabase db push` (if Supabase CLI is installed and linked)

---

## Environment Checklist

Before running or deploying, ensure these variables are set. Use `.env` locally and your hosting provider's env vars (e.g. Vercel) for production.

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_APP_MODE` | Yes | `demo` or `prod` |
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `VITE_OAUTH_REDIRECT_URL` | Optional | For local dev OAuth callback (e.g. `http://localhost:5173`) |
| `VITE_OPENAI_MODEL` | Optional | Display only; server uses its own model (see Edge Function) |
| `VITE_VAPID_PUBLIC_KEY` | Yes | From `npx web-push generate-vapid-keys` (public key only) |

**Note:** `OPENAI_API_KEY` is set in Supabase secrets only, never in `.env` or frontend env.

---

## Edge Functions Deployment

Deploy the Edge Functions after setting their prerequisites:

| Function | Deploy Command | Prerequisites |
|----------|----------------|---------------|
| `openai-chat` | `supabase functions deploy openai-chat` | `OPENAI_API_KEY` + `ALLOWED_ORIGINS` (see below) |
| `send-push` | `supabase functions deploy send-push` | VAPID keys in Supabase (see Push Notifications Setup) |

**Prerequisites for `openai-chat`:**
```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
supabase secrets set ALLOWED_ORIGINS=https://your-app-domain.com
supabase secrets set AI_DAILY_LIMIT=50
```
In production, `ALLOWED_ORIGINS` must be set (comma-separated). If unset, the function returns 403 for all requests (CORS fail-closed). `AI_DAILY_LIMIT` is optional (default 50); when exceeded, returns 429 with `Retry-After` and `X-RateLimit-*` headers; resets at midnight UTC.

**Prerequisite for `send-push`:** Configure VAPID keys in Supabase secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). See [Push Notifications Setup](#push-notifications-setup) below.

**Deploy both:**
```bash
supabase functions deploy openai-chat
supabase functions deploy send-push
```

### Finish deployment after setting ALLOWED_ORIGINS (one-time)

If you set or changed **ALLOWED_ORIGINS** in the Supabase dashboard, the Edge Function must be redeployed so it picks up the secret.

**Option A — From this repo (no Supabase CLI installed):**
1. In a terminal, run once (opens browser to log in):
   ```bash
   npx supabase login
   ```
2. Deploy the function:
   ```bash
   npm run deploy:openai-chat
   ```

**Option B — From the dashboard:**  
Go to [Edge Functions](https://supabase.com/dashboard/project/lcbdafnxwvqbziootvmi/functions) → click **openai-chat** → **Redeploy**.

---

## GPT-5 Nano Setup

> See **Quick Start / Full Setup** above for the full deployment flow. This section is reference for GPT/OpenAI configuration.

1. **Model is configured server-side** in the `openai-chat` Edge Function (e.g. `gpt-5-nano`). The client does not choose the model. Optionally set `VITE_OPENAI_MODEL` in `.env` if you want the UI to display the model name:
   ```env
   VITE_OPENAI_MODEL=gpt-5-nano
   ```

2. **Supabase Edge Function (production):** Set the secret so the API key stays server-side (see [Edge Functions Deployment](#edge-functions-deployment) for deploy commands):
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
   ```

---

## Push Notifications Setup

> See **Quick Start / Full Setup** above for the full flow and VAPID key placement. This section is reference.

1. **Generate VAPID keys** (one-time):
   ```bash
   npx web-push generate-vapid-keys
   ```
   You'll get a public and private key.

2. **Add the public key to `.env`**:
   ```env
   VITE_VAPID_PUBLIC_KEY=your-public-key-base64
   ```
   The public key is safe to expose in the client bundle.

3. **Add secrets to Supabase** (for the `send-push` Edge Function):
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=your-public-key
   supabase secrets set VAPID_PRIVATE_KEY=your-private-key
   supabase secrets set VAPID_SUBJECT=mailto:your-email@example.com
   ```

4. **Deploy the send-push function** — see [Edge Functions Deployment](#edge-functions-deployment).

Without these, push notifications will fail with a generic "Failed to enable push notifications" message.

---

## Supabase Setup

> See **Quick Start / Full Setup** above for the full flow. This section has details.

### Apply migrations

**Dashboard (no CLI):** Supabase Dashboard → SQL Editor. Run in order:
1. `supabase/schema.sql` (base schema)
2. `supabase/run-migrations.sql` (001–005; includes `create_medication_bundle` fix and `ai_daily_usage` for per-user quota)

**CLI:** `supabase db push` (if Supabase CLI is installed and linked)

Details: see [supabase/DATABASE_SETUP.md](supabase/DATABASE_SETUP.md)

### Google OAuth (Sign in with Google)

1. In Supabase Dashboard → **Authentication** → **URL Configuration**:
   - **Site URL**: Your app URL (e.g. `https://your-app.vercel.app` or `http://localhost:5173` for dev)
   - **Redirect URLs**: Add every URL where users can open the app (so the OAuth callback returns to the same tab/PWA). Include:
     - Your production URL, e.g. `https://your-app.vercel.app`
     - Any Vercel deployment URL if users open the app from there (e.g. `https://medflow-care-xxxx.vercel.app`)
     - Local dev: `http://localhost:5173`

2. The app uses the **current window origin** for the Google sign-in redirect (so the home-screen PWA on iOS gets the callback). You do not need `VITE_OAUTH_REDIRECT_URL` in production; optional for local dev.

3. In Google Cloud Console, ensure the OAuth redirect URI is `https://<your-supabase-project>.supabase.co/auth/v1/callback`.

---

## Works on Vercel but not locally

If the app works in production (Vercel) but fails when running locally (`npm run dev`):

1. **Create a local `.env`**  
   Vercel uses env vars from the project dashboard; locally you must have a `.env` file in the project root. Copy from `.env.example` and fill in:
   - `VITE_APP_MODE=prod`
   - `VITE_SUPABASE_URL=` your Supabase project URL (same as in Vercel)
   - `VITE_SUPABASE_ANON_KEY=` your Supabase anon key (same as in Vercel)
   - Optional for Google sign-in: `VITE_OAUTH_REDIRECT_URL=http://localhost:5173`

2. **Allow localhost in Supabase**  
   In Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs**, add:
   - `http://localhost:5173`  
   If this is missing, OAuth sign-in will work on Vercel but redirect back to localhost will be rejected.

3. **Restart the dev server**  
   After changing `.env`, stop the dev server (Ctrl+C) and run `npm run dev` again so Vite picks up the new variables.

### Tables

| Table | Purpose |
|-------|---------|
| profiles, medications, schedules | Core medication data |
| dose_logs | Adherence tracking |
| appointments, notes, refills, notifications | Supporting data |
| push_subscriptions | Web Push notifications |
| ai_conversations | GPT chat history |

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
