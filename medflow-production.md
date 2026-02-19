# MedFlow Care — Full-Stack Production Build Plan

## Goal

Transform MedFlow Care from a client-side demo with hardcoded data into a **production-grade full-stack application** backed by Supabase. Demo mode stays untouched (hardcoded data). Everything else connects to real services.

## Project Type: **WEB** (Vite + React 19 + TypeScript + Tailwind v4)

---

## Current State (Audit Summary)

| Layer | Status | Details |
|-------|--------|---------|
| **Auth** | ❌ Mock | Hardcoded `demo@medflow.app / 123456` — no Supabase Auth |
| **Data** | ❌ Mock | 4 meds, 3 appts, 3 notes, 7-day adherence all hardcoded in `app-store.ts` |
| **Types** | ✅ Good | `shared/types/index.ts` well-structured but unused |
| **Components** | ❌ Missing | `shared/components/` is empty |
| **Design System** | ✅ Excellent | `globals.css` — light/dark themes, CSS variables, animations |
| **API / Services** | ❌ Missing | No Supabase client, no service layer |
| **Tests** | ❌ Missing | Zero test files |
| **Notifications** | ❌ Mock | 4 hardcoded items in `NotificationsPanel` |
| **Env** | ⚠️ Placeholder | `.env.example` has Supabase + Stripe keys as placeholders |

---

## Development prompt assignments (optional; not part of shipped app)

| Prompt | Domain | Responsibilities |
|-------|--------|-----------------|
| `database-architect` | Supabase Schema | Tables, RLS policies, migration SQL, indexes |
| `backend-specialist` | Services + Auth | Supabase client, service layer, auth store, React Query hooks |
| `frontend-specialist` | Components + Views | Shared component lib, view refactoring, form validation, loading/error states |
| `security-auditor` | Auth & RLS Review | Audit RLS policies, auth flow, env var security |
| `test-engineer` | Testing | Vitest unit tests, Playwright E2E |

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Runtime** | Vite 7 + React 19 | Already established, cutting-edge |
| **Language** | TypeScript 5.9 strict | Type-safe, already configured |
| **Styling** | Tailwind v4 + CSS vars | Design system already built |
| **State (Client)** | Zustand 5 | Already in use, lightweight |
| **State (Server)** | TanStack React Query v5 | Cache, optimistic updates, real-time sync |
| **Backend** | Supabase (hosted PostgreSQL + Auth + Realtime + Edge Functions) | Per project requirements |
| **Auth** | Supabase Auth (email/password + Google OAuth) | Built-in, RLS integration |
| **Validation** | Zod | Runtime validation, type inference |
| **Forms** | React Hook Form + Zod resolver | Performant forms |
| **Payments** | Stripe (later phase) | Per project requirements |
| **AI** | GPT-5 Nano API (later phase) | Per project requirements |

---

## Execution Phases

### Phase 1: Database Foundation
**Agent: `database-architect`**

| # | Task | Verify |
|---|------|--------|
| 1 | Design Supabase schema SQL — `profiles`, `medications`, `schedules`, `dose_logs`, `appointments`, `notes`, `refills`, `notifications` | SQL runs clean in Supabase SQL editor |
| 2 | Write RLS policies — users can only CRUD their own data | Test: insert as user A, select as user B returns empty |
| 3 | Create indexes on foreign keys + common query columns | EXPLAIN ANALYZE on typical queries |
| 4 | Write `supabase/schema.sql` migration file in project | File exists, SQL valid |

---

### Phase 2: Auth + Supabase Client
**Agent: `backend-specialist`**

| # | Task | Verify |
|---|------|--------|
| 1 | Install `@supabase/supabase-js`, `@tanstack/react-query`, `zod`, `react-hook-form`, `@hookform/resolvers` | `npm ls` shows packages |
| 2 | Create `src/shared/lib/supabase.ts` — typed Supabase singleton | Import works, TS compiles |
| 3 | Create `src/shared/stores/auth-store.ts` — Supabase Auth (sign up, sign in, sign out, Google OAuth, session listener, `isDemo` flag) | `npm run build` passes |
| 4 | Create `src/shared/lib/query-client.ts` — React Query provider config | Provider wraps app |
| 5 | Keep demo mode: if user is `demo@medflow.app`, load from local `demo-store.ts` instead of Supabase | Demo flow still works |

---

### Phase 3: Service Layer + Data Hooks
**Agent: `backend-specialist`**

| # | Task | Verify |
|---|------|--------|
| 1 | Create `src/shared/services/medications.ts` — Supabase CRUD for medications | TypeScript compiles, types match |
| 2 | Create `src/shared/services/schedules.ts` — schedule CRUD | Types match |
| 3 | Create `src/shared/services/dose-logs.ts` — dose log CRUD | Types match |
| 4 | Create `src/shared/services/appointments.ts` — appointment CRUD | Types match |
| 5 | Create `src/shared/services/notes.ts` — notes CRUD | Types match |
| 6 | Create `src/shared/services/refills.ts` — refill tracking CRUD | Types match |
| 7 | Create `src/shared/hooks/` — React Query hooks (`useMedications`, `useAppointments`, `useDoseLogs`, `useNotes`, etc.) with optimistic updates | `npm run build` passes |

---

### Phase 4: Shared Component Library
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

### Phase 5: View Refactoring (Wire to Real Data)
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

### Phase 6: Real-Time + Notifications
**Agent: `backend-specialist`**

| # | Task | Verify |
|---|------|--------|
| 1 | Supabase Realtime subscription on `dose_logs` + `medications` | UI updates when DB changes |
| 2 | Browser Notification API integration — permission request + push | Browser notification pops up |
| 3 | Notification scheduling logic (dose reminders) | Notification fires at scheduled time |

---

### Phase 7: Security Audit
**Agent: `security-auditor`**

| # | Task | Verify |
|---|------|--------|
| 1 | Audit all RLS policies — no data leaks between users | Cross-user query returns 0 rows |
| 2 | Audit auth flow — no exposed secrets, proper session handling | `.env` not in git, anon key only |
| 3 | Audit input validation — all user inputs validated with Zod | No raw input reaches Supabase |

---

### Phase 8: Testing
**Agent: `test-engineer`**

| # | Task | Verify |
|---|------|--------|
| 1 | Install Vitest + Testing Library + Playwright | `npm ls` shows packages |
| 2 | Unit tests: services (mock Supabase client), auth store, utility functions | `npx vitest run` passes |
| 3 | Component tests: Button, Input, Modal, Card, Badge, Toast | `npx vitest run` passes |
| 4 | E2E tests: login flow, add medication, mark dose, view timeline | `npx playwright test` passes |

---

## Verification Plan

### Automated Tests
```bash
# Unit + Component tests
npx vitest run

# E2E tests (requires dev server running)
npm run dev &
npx playwright test

# Type checking
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build
```

### Manual Verification
1. **Demo mode**: Sign in with `demo@medflow.app / 123456` → hardcoded data loads, everything works read/write locally
2. **Real mode**: Create account with real email → empty state, add medication → persists on refresh
3. **Cross-device**: Sign in on second browser → same data visible
4. **Dark mode**: Toggle theme → all views render correctly
5. **Voice commands**: Tap mic → navigate by saying "medications"

---

## Done When

- [ ] `npm run build` passes with zero errors
- [ ] `npx vitest run` — all tests pass
- [ ] Demo mode works exactly as before (hardcoded data)
- [ ] Real users can sign up, sign in, CRUD all entities
- [ ] Data persists across sessions (Supabase)
- [ ] RLS prevents cross-user data access
- [ ] No mock data in production code paths
