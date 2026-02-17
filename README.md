# MedFlow Care

Medication management app built with React, TypeScript, Vite, and Supabase.

---

## GPT-5 Nano Setup

1. Set the model name in `.env` (no API key in frontend env):
   ```env
   VITE_OPENAI_MODEL=gpt-5-nano
   ```

2. **Supabase Edge Function (production):** Set the secret so the API key stays server-side:
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key
   ```

3. Deploy the `openai-chat` Edge Function and run migrations (see Supabase section below).

---

## Supabase Setup

### Apply migrations

In Supabase Dashboard → SQL Editor, run in order:
1. `supabase/schema.sql` (base schema)
2. `supabase/migrations/001_add_barcode_column.sql`
3. `supabase/migrations/002_push_subscriptions.sql`
4. `supabase/migrations/003_ai_conversations.sql`

Or with Supabase CLI: `supabase db push`

### Google OAuth (Sign in with Google)

1. In Supabase Dashboard → **Authentication** → **URL Configuration**:
   - **Site URL**: Your app URL (e.g. `https://your-app.vercel.app` or `http://localhost:5173` for dev)
   - **Redirect URLs**: Add **both** your production URL and local dev URL, e.g. `https://your-app.vercel.app`, `http://localhost:5173`

2. In `.env`, set `VITE_OAUTH_REDIRECT_URL` to match your app URL (must be in the Redirect URLs list above). For local dev you can use `http://localhost:5173` or omit it (the app uses `window.location.origin` on localhost).

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
