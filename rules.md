# Pitchline — rules.md

## Non-Negotiables

1. **No AI provider keys on the client.** Every call to Claude or Gemini happens
   inside a TanStack Start server route. The browser never sees an API key.
2. **No Lovable-managed Supabase.** This project connects to Ark's own external
   Supabase project, configured manually. Do not let any tool auto-provision a
   separate database.
3. **Single user, no auth complexity.** This does not need multi-user roles,
   invites, or permission tiers. A single simple auth gate (Supabase magic link or
   basic password) is enough — do not over-engineer this.
4. **RLS stays on.** Even for a single-user app, enable Row Level Security on all
   tables and scope policies to the authenticated user's session. Don't disable
   RLS "because it's just one user" — it's a five-minute safeguard against an
   exposed anon key.

## Provider Abstraction Rule

All AI generation must go through one function signature, regardless of provider:

```ts
async function generateDemo(
  prompt: CompiledPrompt,
  provider: 'claude' | 'gemini'
): Promise<{ html: string; tokensUsed: number; generationMs: number }>
```

- Do not write separate call sites for Claude vs Gemini scattered across the app.
- The provider toggle in the UI should be the only branch point; everything after
  that (parsing, error handling, writing to `demos`) is provider-agnostic.
- If a provider call fails (rate limit, timeout, malformed response), surface a
  clear error to the operator — do not silently fall back to the other provider
  without telling them, since output "taste" differs between models and a silent
  swap could produce something the operator didn't ask for.

## Scraper Write Rules

- The scraper is the only writer to `leads` with `source = 'scraper'`. Manual leads
  (`source = 'manual'`) can be added directly through the UI for one-off cases.
- Always upsert on `source_place_id`, never blind-insert — this is the dedup key
  that prevents the same business appearing twice across scrape runs.
- Failed Mailboxlayer validations should still write the lead (with
  `email_status = 'invalid'`), not be dropped — the operator may still want to
  qualify a lead and find contact info manually.
- Scraper writes should never touch `stage` beyond the initial `scraped` value —
  stage progression from there on is operator-driven, not automated.

## Error Handling

- Every server route (generation, scraper webhook if used, template CRUD) wraps
  Supabase and provider calls in try/catch and returns a typed error shape, not a
  raw stack trace, to the frontend.
- Generation failures should leave the lead's `stage` unchanged (not silently
  advance to `demo_built` on a failed call).

## Code Organization

- Server routes for generation live under a clearly named path (e.g.
  `src/routes/api/generate.ts`), separate from any UI route handlers.
- Keep the provider-specific SDK calls (Claude SDK, Gemini SDK) isolated in their
  own small modules (`lib/providers/claude.ts`, `lib/providers/gemini.ts`) behind
  the shared `generateDemo()` interface — this keeps swapping or adding a third
  provider later a one-file change, not a refactor.

## What NOT to build

- No multi-tenant account system
- No public marketing site bolted onto this — it stays a private tool
- No billing/payments logic — this is internal, not a SaaS product
- No need for real-time subscriptions on every table — polling or on-navigation
  refetch is sufficient for a single-user tool; don't add complexity for a
  problem that doesn't exist here
