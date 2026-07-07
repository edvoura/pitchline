# Pitchline Scraper Service

A standalone Node.js web scraping job powered by **OpenStreetMap Overpass API**, Crawlee, and Supabase. It queries businesses for target keywords and locations (e.g. *"dentists in Lagos"*), flags website staleness, extracts emails by crawling, validates them via Mailboxlayer, and writes leads into the cockpit database.

---

## Environment Variables

The scraper reads configuration options from your system environment. Create a `.env` file in this directory with the following variables:

```bash
# Supabase Secrets
SUPABASE_URL=https://tqsksxxmkjnqfakkeyaf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY # Must be Service Role key to bypass RLS

# Email Verification (Optional)
MAILBOXLAYER_API_KEY=YOUR_MAILBOXLAYER_API_KEY

# Scraper Run Parameters (Optional defaults)
QUERY="dentists in Lagos"
LIMIT=15
```

> **Note:** The primary business discovery source (OpenStreetMap Overpass API) is completely free and requires **no API key or signup**. Only Supabase credentials are required for the scraper to function.

### OSM Coverage Notes

OSM data is community-contributed, so completeness varies by region. Expect solid results in major cities (Lagos, Nairobi, London, New York) but potentially sparse data for niche sectors or smaller towns. If a query returns few results, try a broader category or wider geographic area. The scraper will automatically fall back to Apify or SerpAPI if those keys are configured and Overpass returns no results.

---

## Local Setup & Run

1. Navigate to the scraper directory and install dependencies:
   ```bash
   cd scraper
   npm install
   ```
2. Run the script:
   ```bash
   npm start
   ```

---

## Deployment to Railway

To run this on Railway on a schedule:

1. **Deploy Service:** Create a new service on Railway connected to your repository, setting the root directory to `scraper`.
2. **Configure Variables:** Add all the required keys listed in the Environment Variables section to your Railway service settings.
3. **Set Scheduled Cron:** Add a Cron trigger (e.g., `0 0 * * *` for daily runs at midnight) to trigger the start command (`npm start`) automatically.
