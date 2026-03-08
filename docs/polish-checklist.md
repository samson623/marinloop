# MarinLoop Pre-Tester Polish Checklist

> Temporary working checklist. Delete this file when all phases are complete.

Status key: `[ ]` not started | `[-]` in progress | `[x]` done

---

## Phase 1: Create a Tester Guide — `[x]`

**Priority:** Highest — biggest gap in the repo.

No tester-facing documentation exists. `CONTRIBUTING.md` is developer-focused.

**Create `TESTERS.md` at the repo root with:**

- Live app URL (or instructions to access the beta)
- One-paragraph description of MarinLoop (reuse landing screen copy)
- 7 prioritized test flows:
  1. Sign up / onboarding (beta terms, AI consent)
  2. Add a medication (manual + barcode scan)
  3. View medication list and details
  4. Log a dose from the Timeline
  5. Set up and receive a push reminder
  6. Add an appointment
  7. Try the AI assistant (voice or chat)
- What is "in scope" vs. still rough
- How to report issues: use the in-app feedback button (chat icon in the top bar), or simple format: what happened, expected, screenshot, device/browser
- Known limitations and rough edges

**Key file:** `src/app/AppShell.tsx` line 264 — feedback button location.

**Done when:** A new tester can open the app and know exactly what to do without asking.

---

## Phase 2: README Top Section Additions — `[x]`

**Priority:** High — quick win for first impressions.

The README already has "Why MarinLoop" and "Key Features" sections, which are good. Small additions needed.

**Edit `README.md`:**

- Add a live app link near the very top (after the title and tagline)
- Add a "Best Flows to Test" section between "Key Features" and "Screenshots", linking to `TESTERS.md`
- No structural rewrite needed — the README is already stronger than originally assumed

**Done when:** Someone can understand the app and know what to try within 30 seconds.

---

## Phase 3: Clean Repo Surface — `[x]`

**Priority:** Medium — mostly already done.

The repo root is already clean. Specific junk files from the original checklist (`screenshot-meds.cjs`, `test-push.js`, dual Vite configs) do not exist. Scripts are in `scripts/`.

**One action:** Add `.agent/` to `.gitignore`. Currently `.claude/` is gitignored but `.agent/` is not — it contains 400+ dev-internal files (skills, agent prompts, Python scripts, CSV data) that should not ship to outside readers.

**File:** `.gitignore` — add `.agent/` entry.

**Done when:** The repo root looks intentional to an outside reader.

---

## Phase 4: In-App Wording Review Pass — `[x]`

**Priority:** Medium — already in good shape, this is a spot-check.

Empty states are well-written, toasts are specific and calm. This is a review, not a rewrite.

**4a. Nav label clarity**
- "Appts" — verify testers understand the abbreviation
- "Health" maps to `SummaryView` (adherence charts, vitals, journal) — confirm the label matches user expectations

**4b. Empty states audit**
- All major views already have good empty states
- Verify every empty state has a clear CTA button, not just text

**4c. Error message consistency**
- Check toasts use consistent tone ("Could not..." vs "Failed to...")
- Error boundary at `AppShell.tsx` line 200 says "Something went wrong. Please refresh." — consider adding a retry button

**4d. AI wording safety**
- AI consent modal, system prompts, and terms already have strong disclaimers
- Verify the AI chat UI itself shows a visible disclaimer near the input

**Key files:**
- `src/app/AppShell.tsx` — nav labels (lines 41-47), error boundary (line 200)
- `src/app/views/TimelineView.tsx` — empty state, error state
- `src/app/views/MedsView.tsx` — empty state
- `src/app/views/SummaryView.tsx` — "Health" title (line 183)
- `src/app/views/CareView.tsx` — empty states for providers, caregivers, emergency contacts

**Done when:** Nothing in the app feels confusing, overly technical, or half-finished.

---

## Phase 5: Trust and Safety Spot-Check — `[x]`

**Priority:** Low — already strong. Verification only.

Comprehensive disclaimers, AI consent flow, privacy policy, and terms of service all exist in-app.

**Verify:**
- AI consent revocation works end-to-end (Profile > Data & Privacy > revoke > AI features stop)
- Medication error states fail gracefully (no raw errors, no blank screens)
- Push notification failure states show calm messages
- "Not medical advice" disclaimer appears on landing screen (`src/app/LandingScreen.tsx`)
- BetaTermsModal cannot be bypassed

**No code changes expected** unless a broken flow is found.

**Done when:** The app feels careful and trustworthy, not casual.

---

## Phase 6: Full Test Suite + Manual Smoke Test — `[x]`

**Priority:** High — run before inviting any testers.

Infrastructure exists: CI with typecheck/lint/tests/bundle-size/Lighthouse, 30+ unit tests, 5 E2E specs, Playwright on Chromium + Mobile Chrome.

**Automated:**
- `npm run typecheck` — fix any errors
- `npm run lint` — fix any errors
- `npm run test` — fix any failures
- `npm run build` — confirm clean production build

**Manual smoke test (one clean account):**
- Create a fresh account from the landing page
- Walk through onboarding (beta terms, AI consent, add-to-home-screen prompt)
- Add a medication, log a dose, check Timeline
- Set a reminder, verify push notification arrives
- Check mobile layout on a real device
- Verify PWA install flow

**Done when:** Testers find real usability issues, not obvious brokenness.

---

## Phase 7: Feedback Discoverability — `[x]`

**Priority:** Low — system is already built.

`FeedbackModal` exists in the top bar (chat bubble icon), writes to `beta_feedback` table, admin panel has a Feedback tab with filtering.

**Actions:**
- Verify the feedback button at `AppShell.tsx` line 264 is visually obvious
- Consider adding a tooltip on first use
- Mention the feedback button explicitly in `TESTERS.md`

**No new infrastructure needed.**

**Done when:** Testers can report issues without asking how.

---

## Estimated Effort

| Phase | Effort | New code? |
|-------|--------|-----------|
| 1. Tester guide | ~45 min | New file |
| 2. README additions | ~20 min | Small edits |
| 3. Gitignore .agent/ | ~2 min | One line |
| 4. Wording review | ~1 hour | Minor tweaks |
| 5. Trust spot-check | ~30 min | Likely none |
| 6. Test suite run | ~1-2 hours | Bug fixes only |
| 7. Feedback discoverability | ~15 min | Tooltip or docs mention |
