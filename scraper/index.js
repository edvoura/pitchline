import { createClient } from "@supabase/supabase-js";
import { CheerioCrawler } from "crawlee";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.PLACES_API_KEY;
const MAILBOXLAYER_API_KEY = process.env.MAILBOXLAYER_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configurable scraping settings
const SEARCH_QUERY = process.env.QUERY || "dentists in Lagos";
const MAX_PLACES = parseInt(process.env.LIMIT || "10", 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
  process.exit(1);
}

if (!GOOGLE_PLACES_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Regex to extract emails
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Helper: Filter out false-positive emails (e.g., images, domain defaults)
function isValidEmailPattern(email) {
  const lowercase = email.toLowerCase();
  const invalidExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"];
  const invalidDomains = ["example.com", "yourdomain.com", "domain.com", "email.com", "sentry.io", "wix.com"];

  if (invalidExtensions.some((ext) => lowercase.endsWith(ext))) return false;
  if (invalidDomains.some((dom) => lowercase.includes(dom))) return false;

  return true;
}

// Helper: Mailboxlayer validation
async function validateEmail(email) {
  if (!MAILBOXLAYER_API_KEY) {
    console.log(`[Mailboxlayer] API key missing. Format validation only for: ${email}`);
    return "unknown";
  }

  try {
    const res = await fetch(`http://apilayer.net/api/check?access_key=${MAILBOXLAYER_API_KEY}&email=${encodeURIComponent(email)}`);
    if (!res.ok) {
      console.warn(`[Mailboxlayer] API returned status ${res.status}`);
      return "unknown";
    }

    const payload = await res.json();
    if (payload.success === false) {
      console.warn("[Mailboxlayer] API error:", payload.error);
      return "unknown";
    }

    // Check mailboxlayer quality metric
    const isValid = payload.format_valid && payload.mx_found;
    return isValid ? "valid" : "invalid";
  } catch (err) {
    console.error(`[Mailboxlayer] Validation request failed for ${email}:`, err.message);
    return "unknown";
  }
}

async function run() {
  console.log(`\n========================================`);
  console.log(`[Scraper] Starting job for: "${SEARCH_QUERY}"`);
  console.log(`========================================`);

  // 1. Query Google Places API
  console.log(`[Places] Querying Text Search API...`);
  const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(SEARCH_QUERY)}&key=${GOOGLE_PLACES_API_KEY}`;
  
  let candidates = [];
  try {
    const res = await fetch(placesUrl);
    if (!res.ok) throw new Error(`Google Places HTTP error: ${res.status}`);
    const data = await res.json();
    
    if (data.status === "OVER_QUERY_LIMIT") {
      console.error("[Places] Google API rate-limit reached. Stopping job.");
      return;
    }
    if (data.status === "REQUEST_DENIED") {
      console.error(`[Places] Request denied: ${data.error_message || "Invalid API key"}`);
      return;
    }
    
    const results = data.results || [];
    console.log(`[Places] Found ${results.length} total matches.`);
    
    // Slice down to our limit
    candidates = results.slice(0, MAX_PLACES).map((item) => ({
      placeId: item.place_id,
      businessName: item.name,
      address: item.formatted_address || "—",
      phone: item.formatted_phone_number || "",
      website: item.website || "", // Places TextSearch response may have website, if not empty
      raw: item
    }));
  } catch (err) {
    console.error("[Places] Failed to fetch places:", err.message);
    return;
  }

  if (candidates.length === 0) {
    console.log("[Scraper] No candidates to process. Job finished.");
    return;
  }

  // 2. Resolve additional website/details for each candidate if needed
  // Note: TextSearch doesn't always return the website column directly.
  // We perform secondary details fetching for entries missing websites to be thorough.
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    if (!cand.website) {
      console.log(`[Details] Fetching detailed profile for "${cand.businessName}"...`);
      try {
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${cand.placeId}&fields=website,formatted_phone_number&key=${GOOGLE_PLACES_API_KEY}`;
        const res = await fetch(detailsUrl);
        if (res.ok) {
          const detailData = await res.json();
          if (detailData.result) {
            if (detailData.result.website) cand.website = detailData.result.website;
            if (detailData.result.formatted_phone_number) cand.phone = detailData.result.formatted_phone_number;
          }
        }
      } catch (err) {
        console.warn(`[Details] Failed to retrieve details for ${cand.businessName}:`, err.message);
      }
    }
  }

  // 3. Crawl candidates' websites to find contact emails
  const urlsToCrawl = candidates
    .filter((c) => c.website)
    .map((c) => ({ url: c.website, placeId: c.placeId }));

  const crawledEmailsMap = new Map(); // placeId -> Set of found emails

  if (urlsToCrawl.length > 0) {
    console.log(`\n[Crawlee] Enqueueing ${urlsToCrawl.length} websites for email harvesting...`);

    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: urlsToCrawl.length * 5, // Max 5 pages per site
      requestHandlerTimeoutSecs: 15,
      maxConcurrency: 5,
      
      async requestHandler({ $, request, enqueueLinks }) {
        const currentUrl = request.url;
        const placeId = request.userData.placeId;
        const pageText = $("body").text() || "";

        // Scrape emails from page text
        const matches = pageText.match(EMAIL_REGEX) || [];
        const validMatches = matches.filter(isValidEmailPattern);

        if (validMatches.length > 0) {
          if (!crawledEmailsMap.has(placeId)) {
            crawledEmailsMap.set(placeId, new Set());
          }
          validMatches.forEach((email) => crawledEmailsMap.get(placeId).add(email.toLowerCase()));
        }

        // Enqueue links pointing to Contact / About pages
        await enqueueLinks({
          globs: ["**/contact*", "**/about*", "**/info*", "**/contact-us*", "**/about-us*"],
          strategy: "same-domain",
          transformRequestFunction(req) {
            req.userData = { placeId }; // Keep track of placeId association
            return req;
          }
        });
      },

      failedRequestHandler({ request, error }) {
        console.warn(`[Crawlee] Crawl failed for ${request.url}:`, error.message);
      }
    });

    // Populate initial requests
    const initialRequests = urlsToCrawl.map((item) => ({
      url: item.url,
      userData: { placeId: item.placeId }
    }));

    try {
      await crawler.run(initialRequests);
    } catch (err) {
      console.error("[Crawlee] Crawler run error:", err.message);
    }
  }

  // 4. Map candidates, validate emails, and format for DB upsert
  console.log(`\n[Validation] Processing leads for database write...`);
  const finalLeads = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    let foundEmail = "";
    
    if (crawledEmailsMap.has(cand.placeId)) {
      const emailSet = crawledEmailsMap.get(cand.placeId);
      if (emailSet.size > 0) {
        // Pick the first discovered email
        foundEmail = Array.from(emailSet)[0];
        console.log(`[Crawlee] Found email for "${cand.businessName}": ${foundEmail}`);
      }
    }

    // Validate email if found
    let emailStatus = "unknown";
    if (foundEmail) {
      emailStatus = await validateEmail(foundEmail);
    }

    // Heuristics for website status (if exists, check response code)
    let hasWebsite = !!cand.website;

    finalLeads.push({
      business: cand.businessName,
      industry: SEARCH_QUERY.split(" in ")[0] || "General Scrape",
      location: cand.address,
      email: foundEmail || null,
      has_website: hasWebsite,
      email_status: emailStatus,
      qualification: "pending",
      stage: "scraped",
      source: "scraper",
      source_place_id: cand.placeId,
      raw_scrape: cand.raw
    });
  }

  // 5. Upsert leads to Supabase
  console.log(`\n[Database] Upserting ${finalLeads.length} leads to Supabase...`);
  try {
    const { data, error } = await supabase
      .from("leads")
      .upsert(finalLeads, { onConflict: "source_place_id" })
      .select();

    if (error) throw error;

    console.log(`\n========================================`);
    console.log(`[Success] Scraper job completed!`);
    console.log(`Upserted ${data?.length || 0} leads successfully.`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error("[Database] Failed to upsert leads to Supabase:", err.message);
  }
}

run();
