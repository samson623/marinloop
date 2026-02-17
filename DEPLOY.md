# Push to GitHub & Deploy on Vercel

## 1. Fix Git lock (if you see "index.lock" errors)

Close any other Git tools (VS Code Git UI, GitHub Desktop, etc.), then in PowerShell:

```powershell
cd "c:\Users\1sams\OneDrive\Desktop\_MEDFLOW CARE TEST"
Remove-Item .git\index.lock -Force -ErrorAction SilentlyContinue
```

## 2. Push to GitHub

Run these in your project folder (your GitHub login will be used):

```powershell
cd "c:\Users\1sams\OneDrive\Desktop\_MEDFLOW CARE TEST"

git add src/app/App.tsx src/shared/services/voice-intent.ts src/shared/types/contracts.ts vite.config.mjs
git commit -m "Voice: fix isFinal handling, add add_note intent, voice test bar, vite.config.mjs"
git push origin main
```

If prompted for credentials, sign in with your GitHub account (or use a Personal Access Token if you use 2FA).

## 3. Deploy on Vercel

### Option A: Connect GitHub (recommended)

1. Go to [vercel.com](https://vercel.com) and sign in (use “Continue with GitHub” if you use GitHub).
2. Click **Add New…** → **Project**.
3. **Import** the `samson623/medflow-care` repository (or your fork).
4. Vercel will detect Vite and use:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Framework:** Vite  
   (These are already set in `vercel.json`.)
5. Add **Environment Variables** if needed (e.g. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in Project Settings → Environment Variables.
6. Click **Deploy**. Future pushes to `main` will auto-deploy.

### Option B: Deploy with Vercel CLI

```powershell
cd "c:\Users\1sams\OneDrive\Desktop\_MEDFLOW CARE TEST"
npx vercel
```

Follow the prompts (link to existing project or create new one). To deploy to production:

```powershell
npx vercel --prod
```

---

After deployment, your app will be at `https://your-project.vercel.app` (or your custom domain).
