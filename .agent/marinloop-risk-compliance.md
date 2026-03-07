# MarinLoop Risk & Compliance — Specialist Index

This document maps **identified risks and gaps** to the **specialist agents** that own them. Use it when you need to invoke the right expertise for MarinLoop safety, cost, UX, and legal positioning.

---

## Risk areas and owners

| Risk / gap | Specialist agent | Use when |
|------------|------------------|----------|
| **No tests, no CI** — schedule math, timeline sort, dose-log mutations, auth/session untested | `marinloop-testing-ci-specialist` | Adding or changing tests; introducing CI; touching schedule, timeline, dose-log, or auth logic. |
| **OpenAI edge cost/abuse** — model from request, permissive CORS, no rate limit | `marinloop-api-cost-guardrails-specialist` | Changing `openai-chat` or any pay-per-use AI endpoint; cost or abuse review. |
| **PWA push reliability** — delivery not guaranteed; UX should say so | `marinloop-pwa-push-ux-specialist` | Push or Add-to-Home-Screen copy; setting user expectations about reminder delivery. |
| **Medical-grade positioning** — keep product language to "reminders + tracking"; avoid regulated claims | `marinloop-legal-compliance-specialist` | Disclaimers, landing/marketing copy, new features that touch health wording or scope. |

---

## Quick invoke guide

- **"We need tests and CI"** → `marinloop-testing-ci-specialist`
- **"Lock down the OpenAI function"** / **"Rate limit the AI"** → `marinloop-api-cost-guardrails-specialist`
- **"Users think reminders are guaranteed"** / **"Push copy"** → `marinloop-pwa-push-ux-specialist`
- **"Disclaimer"** / **"Product positioning"** / **"Legal wording"** → `marinloop-legal-compliance-specialist`
- **Full risk review** → Invoke all four (orchestrator can coordinate).

---

## Key files (by risk)

| Risk | Key files to consider |
|------|------------------------|
| Testing / CI | `src/shared/services/schedules.ts`, `useTimeline.ts`, `dose-logs.ts`, `useDoseLogs.ts`, `auth-store.ts`, `package.json` |
| API cost | `supabase/functions/openai-chat/index.ts`, `src/shared/services/ai.ts` |
| PWA / push | `src/shared/lib/device.ts`, `AddToHomeScreenPrompt.tsx`, `usePushNotifications.ts`, `ProfileView.tsx` |
| Legal | `LoginScreen.tsx`, `LandingScreen.tsx`, any product or feature copy |

---

See each agent's `.md` file in [.agent/agents/](.agent/agents/) for full mandate, checklists, and boundaries.
