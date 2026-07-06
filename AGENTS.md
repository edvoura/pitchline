<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Pitchline — agents.md

This document defines the one autonomous/scheduled process in the system: the
lead-scraper job. This is the only "agent" in Pitchline — the web app itself is
fully operator-driven, with no autonomous behavior beyond the AI generation call
that the operator explicitly triggers.

## Scraper Agent

**Runs on:** Railway, as a scheduled job (cron) or manually triggered via CLI.
**Purpose:** Discover businesses that lack a website or have an outdated one,
validate contact emails, and write qualified-for-review leads into Supabase.

### Step Sequence

1. **Source businesses** — query Google Places API for a target category +
   location (operator-configured search terms, e.g. "dentists in Lagos").
2. **Filter candidates** — flag businesses with no `website` field in the Places
   response, or whose website returns a non-200 status / looks stale (optional
   secondary check: fetch the site, check for outdated indicators like no HTTPS,
   ancient copyright year, or broken assets — keep this heuristic simple, don't
   over-invest in "is this ugly" scoring at the agent level; that judgment call
   stays with the operator in the Leads screen).
3. **Extract contact info** — pull business name, phone, address, and any listed
   email from the Places result or a lightweight crawl of the business's own site
   (via Crawlee) if no email is directly listed.
4. **Validate email** — run through Mailboxlayer. Do not discard invalid results;
   write them with `email_status = 'invalid'` so the operator can decide.
5. **Dedup** — upsert on `source_place_id` (Google Places unique ID). Never create
   a duplicate row for a business already scraped in a prior run.
6. **Write to Supabase** — insert/update `leads` with `source = 'scraper'`,
   `stage = 'scraped'`, and the raw payload in `raw_scrape` for later debugging.

### Boundaries

- The scraper agent never modifies `stage` beyond initial insert. It does not
  qualify, reject, or advance leads — that's an operator action in the UI.
- The scraper agent never triggers demo generation. Generation is only initiated
  by the operator from the Prompt Generator screen.
- The scraper agent has no knowledge of prompts, demos, or templates — it only
  ever touches the `leads` table.
- If Google Places or Mailboxlayer rate-limits the job mid-run, log and stop
  gracefully — do not retry-loop aggressively against a rate-limited API.

### Scheduling Notes

- Start with manual triggers while validating output quality; move to a daily or
  weekly cron once the scrape parameters (location, category, qualification
  heuristics) are dialed in.
- Keep each run scoped to one search term + location combination rather than a
  giant multi-category sweep — smaller, reviewable batches are easier to qualify
  than a flood of unsorted leads.
