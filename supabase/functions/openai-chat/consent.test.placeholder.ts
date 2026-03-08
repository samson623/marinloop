/**
 * Edge Function Consent Tests — PLACEHOLDER
 *
 * These tests cannot run under Vitest because the edge functions are written
 * for the Deno runtime (they import from https://deno.land and use Deno.env).
 * Vitest targets the Node/browser environment.
 *
 * To add runnable tests for the consent enforcement in openai-chat and
 * extract-label you have two options:
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OPTION A — Deno test runner (recommended)
 *
 * Create test files alongside the functions using Deno's built-in test runner:
 *
 *   supabase/functions/openai-chat/consent_test.ts
 *   supabase/functions/extract-label/consent_test.ts
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/openai-chat/consent_test.ts
 *
 * See the pseudocode below for what each test should assert.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OPTION B — Integration tests against local Supabase (supabase start)
 *
 * Use `supabase functions serve` and `fetch()` from an integration test file
 * (Node or Deno) to send real HTTP requests and assert on status codes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHAT SHOULD BE TESTED (pseudocode for both functions)
 * ======================================================
 *
 * describe('openai-chat — consent enforcement', () => {
 *
 *   it('returns 403 with "AI consent required" when ai_consent_granted is false', async () => {
 *     // Arrange:
 *     //   - mock Supabase auth.getUser() → returns a valid user
 *     //   - mock profiles SELECT → returns { ai_consent_granted: false }
 *     //   - mock ai_daily_usage / OPENAI_API_KEY etc.
 *     //
 *     // Act: POST /openai-chat with valid JWT + valid messages body
 *     //
 *     // Assert:
 *     //   response.status === 403
 *     //   (await response.json()).error contains "AI consent required"
 *   })
 *
 *   it('returns 403 when the profiles row does not exist (null profile)', async () => {
 *     // mock profiles SELECT → returns { data: null, error: null }
 *     // Assert: response.status === 403
 *   })
 *
 *   it('proceeds past consent check and reaches quota logic when ai_consent_granted is true', async () => {
 *     // mock profiles SELECT → returns { ai_consent_granted: true }
 *     // mock ai_daily_usage → returns { request_count: 0 }
 *     // mock OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY
 *     // The request will reach the OpenAI fetch() call; stub that to return
 *     // a valid chat completion response.
 *     // Assert: response.status === 200
 *   })
 *
 * })
 *
 * describe('extract-label — consent enforcement', () => {
 *
 *   it('returns 403 with "AI consent required" when ai_consent_granted is false', async () => {
 *     // Same pattern as openai-chat above.
 *     // Body: { images: ['data:image/jpeg;base64,/9j/...'] }
 *     // Assert: response.status === 403
 *   })
 *
 *   it('returns 403 when profiles row is missing', async () => {
 *     // mock profiles SELECT → returns { data: null, error: null }
 *     // Assert: response.status === 403
 *   })
 *
 *   it('proceeds to OpenAI when ai_consent_granted is true', async () => {
 *     // mock profiles SELECT → returns { ai_consent_granted: true }
 *     // mock ai_daily_usage, stub fetch() for OpenAI
 *     // Assert: response.status === 200
 *   })
 *
 * })
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE CONSENT CHECK LIVES IN THE SOURCE
 *
 * openai-chat/index.ts  line ~138:
 *   const { data: profile } = await supabase.from('profiles').select('ai_consent_granted').eq('id', user.id).single()
 *   if (!profile?.ai_consent_granted) {
 *     return new Response(JSON.stringify({ error: 'AI consent required. ...' }), { status: 403, ... })
 *   }
 *
 * extract-label/index.ts  line ~212:
 *   const { data: profile } = await supabase.from('profiles').select('ai_consent_granted').eq('id', user.id).single()
 *   if (!profile?.ai_consent_granted) {
 *     return new Response(JSON.stringify({ error: 'AI consent required. ...' }), { status: 403, ... })
 *   }
 */

// This file is intentionally empty of runnable code.
// It is excluded from Vitest via the `include` glob (src/**/*.{test,spec}.*).
export {}
