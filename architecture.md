# Pitchline — architecture.md

## System Overview

Pitchline is a single-user internal web app for Trendtactics Digital. It turns
scraped business leads into AI-generated website demos and tracks outreach through
a lightweight pipeline. There is no multi-tenancy, no public signup, and no end-user
facing surface — the only user is the operator (Ark).

## Service Boundaries

```
┌─────────────────────┐      writes leads       ┌──────────────────┐
│  Scraper Service     │ ───────────────────────▶│                  │
│  (Railway, Crawlee)  │                          │                  │
└─────────────────────┘                          │                  │
                                                   │    Supabase      │
┌─────────────────────┐   reads/writes all data   │  (Postgres +     │
│  Pitchline Web App   │◀─────────────────────────▶│   Auth + RLS)    │
│  (Vercel, TanStack   │                          │                  │
│   Start)             │                          └──────────────────┘
└─────────┬───────────┘
          │ server-side only
          ▼
┌─────────────────────┐
│  AI Generation Layer │
│  Claude API / Gemini │
└─────────────────────┘
```

Three independent services, one shared database:

1. **Scraper Service** (Railway) — standalone Crawlee job, no UI. Pulls leads via
   Google Places, validates emails via Mailboxlayer, writes directly to the
   `leads` table in Supabase. Runs on a schedule or manual trigger. Does not talk
   to the web app directly — Supabase is the only integration point.

2. **Pitchline Web App** (Vercel, TanStack Start) — the operator-facing UI (Leads,
   Generator, Preview, Tracker, Templates). Talks to Supabase for all data reads/
   writes. Never calls Claude/Gemini directly from the client — all AI generation
   happens through server-side routes only, so API keys never reach the browser.

3. **AI Generation Layer** — a provider-agnostic server function
   (`generateDemo(prompt, provider)`) that routes to Claude API or Gemini API based
   on the operator's toggle. Lives inside the web app as a TanStack Start server
   route, not a separate service — no need for extra infra here.

## Data Flow

**Lead intake:**
Scraper (Railway) → Google Places (source) → Mailboxlayer (validate) → dedup
check → insert into `leads` (stage = `scraped`)

**Demo generation:**
Operator qualifies lead in UI → fills Prompt Generator form → compiles structured
prompt (per `skills.md`) → saves to `prompts` table → clicks Generate → server
route calls `generateDemo()` → response HTML written to `demos` table → lead stage
updates to `demo_built`

**Outreach tracking:**
Operator reviews demo in Preview → marks Ready & Send → lead stage → `sent` →
manually updated to `viewed`/`replied`/`won`/`lost` as responses come in

## Database Schema

Use the schema already validated by Antigravity's audit (`leads`, `prompts`,
`demos`, `templates`), with these additions:

```sql
-- Add to leads table: scraper provenance + dedup key
alter table public.leads
  add column source text default 'manual' check (source in ('manual', 'scraper')),
  add column source_place_id text unique, -- Google Places ID, prevents duplicate scrapes
  add column raw_scrape jsonb; -- original scraped payload for debugging/reprocessing

-- Add to prompts table: support for the "custom" section item
-- (sections is already text[], no schema change needed — just ensure the
-- frontend allows appending an arbitrary string, not just the five presets)

-- Add to demos table: token/cost tracking for provider comparison
alter table public.demos
  add column tokens_used integer,
  add column generation_ms integer; -- generation latency, useful for A/B comparison
```

Keep `prompts`, `demos`, and `templates` exactly as Antigravity specified otherwise
— no need to diverge from a schema that's already correctly modeled.

## Environment & Secrets

All API keys (Claude, Gemini, Supabase service role, Mailboxlayer, Google Places)
live server-side only:

- Web app: Vercel environment variables, accessed only inside server routes
- Scraper: Railway environment variables
- Never expose service-role Supabase key to the client — the web app uses the
  anon key + RLS policies for client reads, service-role key only in server routes
  if a privileged write is ever needed

## Hosting

- Web app: Vercel, private URL (not indexed, no public signup flow)
- Scraper: Railway, scheduled job (cron) or manually triggered via Railway CLI
- Database: Supabase (single project, shared by both services)
