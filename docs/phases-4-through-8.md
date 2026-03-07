# MarinLoop — Execution Phases 4 Through 8

Complete plans from **marinloop-production.md**, starting at Phase 4.

---

## Phase 4: Shared Component Library
**Agent: `frontend-specialist`**

| # | Task | Verify |
|---|------|--------|
| 1 | Build `src/shared/components/Button.tsx` — variants (primary, secondary, danger, ghost), sizes, loading state | Renders correctly |
| 2 | Build `src/shared/components/Input.tsx` — styled input with label, error state, forwarded ref | Focus, error display work |
| 3 | Build `src/shared/components/Modal.tsx` — bottom sheet + centered dialog variants | Opens/closes correctly |
| 4 | Build `src/shared/components/Card.tsx` — base card with interactive variant | Hover effects work |
| 5 | Build `src/shared/components/Badge.tsx` — status badges (done, late, missed, upcoming) | Color variants render |
| 6 | Build `src/shared/components/Spinner.tsx` + `EmptyState.tsx` — loading/empty patterns | Displays in loading state |
| 7 | Build `src/shared/components/Toast.tsx` — extract from App.tsx, make reusable | Toast notifications work |

---

## Phase 5: View Refactoring (Wire to Real Data)
**Agent: `frontend-specialist`**

| # | Task | Verify |
|---|------|--------|
| 1 | Refactor `App.tsx` — add `QueryClientProvider`, auth-aware routing, use `auth-store` | App switches between demo/real mode |
| 2 | Refactor `LoginScreen.tsx` — real sign up / sign in / forgot password / Google OAuth | Sign in with real Supabase creds works |
| 3 | Refactor `TimelineView.tsx` — use `useDoseLogs()` + `useMedications()` hooks, loading/error/empty states | Shows real data or loading skeleton |
| 4 | Refactor `MedsView.tsx` — use `useMedications()`, real add/edit/delete, form validation with Zod | CRUD operations persist to Supabase |
| 5 | Refactor `ApptsView.tsx` — use `useAppointments()`, real CRUD | CRUD persists |
| 6 | Refactor `SummaryView.tsx` — computed from real dose_logs | Adherence % matches DB data |
| 7 | Refactor `ProfileView.tsx` — show real user info, plan tier, sign out | Profile reflects Supabase user |
| 8 | Refactor `NotificationsPanel` — show real notifications from DB | Shows DB notifications |
| 9 | Refactor `app-store.ts` — remove ALL hardcoded mock data, keep as thin client-side state | No mock data except in demo-store |

---

## Phase 6: Real-Time + Notifications
**Agent: `backend-specialist`**

| # | Task | Verify |
|---|------|--------|
| 1 | Supabase Realtime subscription on `dose_logs` + `medications` | UI updates when DB changes |
| 2 | Browser Notification API integration — permission request + push | Browser notification pops up |
| 3 | Notification scheduling logic (dose reminders) | Notification fires at scheduled time |

---

## Phase 7: Security Audit
**Agent: `security-auditor`**

| # | Task | Verify |
|---|------|--------|
| 1 | Audit all RLS policies — no data leaks between users | Cross-user query returns 0 rows |
| 2 | Audit auth flow — no exposed secrets, proper session handling | `.env` not in git, anon key only |
| 3 | Audit input validation — all user inputs validated with Zod | No raw input reaches Supabase |

---

## Phase 8: Testing
**Agent: `test-engineer`**

| # | Task | Verify |
|---|------|--------|
| 1 | Install Vitest + Testing Library + Playwright | `npm ls` shows packages |
| 2 | Unit tests: services (mock Supabase client), auth store, utility functions | `npx vitest run` passes |
| 3 | Component tests: Button, Input, Modal, Card, Badge, Toast | `npx vitest run` passes |
| 4 | E2E tests: login flow, add medication, mark dose, view timeline | `npx playwright test` passes |

---

*Source: marinloop-production.md — Execution Phases*
