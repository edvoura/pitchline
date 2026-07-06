# Pitchline Contact Scraper API

Zero-dependency Python serverless API on Vercel that extracts emails and phone
numbers from any public webpage. Pure stdlib — no pip installs, no FastAPI, no
Flask.

## Endpoints

### `POST /api/scrape`
Request:
```json
{ "url": "https://example-business.com" }
```
Response:
```json
{
  "url": "https://example-business.com",
  "emails": ["contact@example-business.com"],
  "phones": ["+234 812 345 6789"]
}
```
Error (invalid URL / fetch failure):
```json
{ "error": "Invalid or missing 'url' field" }
```
Returns HTTP 400 on any URL/fetch error, 200 on success.

### `GET /api/health`
```json
{ "status": "ok" }
```

## Deploy

1. Push this folder to a GitHub repo (or add to the existing Pitchline monorepo
   under a subfolder, e.g. `scraper-api/`)
2. In Vercel: New Project → import the repo → set Root Directory if it's a
   subfolder → Deploy
3. No environment variables needed — this endpoint has no external dependencies
   or API keys
4. Test:
   ```bash
   curl -X POST https://your-project.vercel.app/api/scrape \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com"}'

   curl https://your-project.vercel.app/api/health
   ```

## How This Fits Into Pitchline

Use this as a fallback enrichment step in the scraper pipeline: if Google Places
doesn't return an email for a lead, call this endpoint with the business's
website URL (if one exists) before falling back to Mailboxlayer-only validation.
This keeps the core scraper's email-harvesting logic simple while adding a
reusable, independent enrichment service you can call from anywhere — the
Railway scraper job, a manual lookup in the UI, or later tools.

## Notes on Scope
- Fetches a single page only (the URL given) — does not crawl a whole site.
  If you want whole-site crawling later, that's a separate, heavier job better
  suited to the existing Crawlee-based scraper on Railway, not this lightweight
  endpoint.
- Respects a 10-second timeout per fetch — if a site is slow/unresponsive, it
  fails cleanly with a 400 rather than hanging.
