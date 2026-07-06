import { createClient } from "@supabase/supabase-js";
import { CheerioCrawler } from "crawlee";
import dotenv from "dotenv";
import { buildQueryList } from "./matrix.js";

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.PLACES_API_KEY || process.env.GEMINI_API_KEY;
const MAILBOXLAYER_API_KEY = process.env.MAILBOXLAYER_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Configurable scraping settings
const REGION_PARAM = process.env.REGION || "all";
const SECTOR_PARAM = process.env.SECTOR || "all";
const RAW_QUERY = process.env.QUERY;
const MAX_PLACES = parseInt(process.env.LIMIT || "5", 10);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials. Ensure SUPABASE_URL and a valid API key are set.");
  process.exit(1);
}

if (!GOOGLE_PLACES_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY or GEMINI_API_KEY.");
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
    return "unknown";
  }

  try {
    const res = await fetch(`http://apilayer.net/api/check?access_key=${MAILBOXLAYER_API_KEY}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return "unknown";

    const payload = await res.json();
    if (payload.success === false) return "unknown";

    const isValid = payload.format_valid && payload.mx_found;
    return isValid ? "valid" : "invalid";
  } catch (err) {
    return "unknown";
  }
}

async function scrapeSingleQuery(query) {
  console.log(`\n========================================`);
  console.log(`[Scraper] Processing query: "${query}"`);
  console.log(`========================================`);

  const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
  
  let candidates = [];
  try {
    const res = await fetch(placesUrl);
    if (!res.ok) throw new Error(`Google Places HTTP error: ${res.status}`);
    const data = await res.json();

    if (data.status === "OVER_QUERY_LIMIT") {
      console.error("[Places] Google API rate-limit reached.");
      return 0;
    }
    if (data.status === "REQUEST_DENIED") {
      console.error(`[Places] Request denied: ${data.error_message || "Invalid API key"}.`);
      return 0;
    }

    const results = data.results || [];
    console.log(`[Places] Found ${results.length} total matches.`);

    candidates = results.slice(0, MAX_PLACES).map((item) => ({
      placeId: item.place_id,
      businessName: item.name,
      address: item.formatted_address || "—",
      phone: item.formatted_phone_number || "",
      website: item.website || "",
      raw: item
    }));
  } catch (err) {
    console.error("[Places] Failed to fetch places:", err.message);
    return 0;
  }

  if (candidates.length === 0) {
    console.log("[Scraper] No candidates found for this query.");
    return 0;
  }

  // Crawl candidates' websites to find contact emails
  const urlsToCrawl = candidates
    .filter((c) => c.website)
    .map((c) => ({ url: c.website, placeId: c.placeId }));

  const crawledEmailsMap = new Map();

  if (urlsToCrawl.length > 0) {
    console.log(`[Crawlee] Enqueueing ${urlsToCrawl.length} websites for email harvesting...`);

    const crawler = new CheerioCrawler({
      maxRequestsPerCrawl: urlsToCrawl.length * 4,
      requestHandlerTimeoutSecs: 15,
      maxConcurrency: 3,
      
      async requestHandler({ $, request, enqueueLinks }) {
        const placeId = request.userData.placeId;
        const pageText = $("body").text() || "";

        const matches = pageText.match(EMAIL_REGEX) || [];
        const validMatches = matches.filter(isValidEmailPattern);

        if (validMatches.length > 0) {
          if (!crawledEmailsMap.has(placeId)) {
            crawledEmailsMap.set(placeId, new Set());
          }
          validMatches.forEach((email) => crawledEmailsMap.get(placeId).add(email.toLowerCase()));
        }

        await enqueueLinks({
          globs: ["**/contact*", "**/about*", "**/info*", "**/contact-us*", "**/about-us*"],
          strategy: "same-domain",
          transformRequestFunction(req) {
            req.userData = { placeId };
            return req;
          }
        });
      },

      failedRequestHandler({ request, error }) {
        console.warn(`[Crawlee] Crawl skipped for ${request.url}:`, error.message);
      }
    });

    const initialRequests = urlsToCrawl.map((item) => ({
      url: item.url,
      userData: { placeId: item.placeId }
    }));

    try {
      await crawler.run(initialRequests);
    } catch (err) {
      console.error("[Crawlee] Crawler run warning:", err.message);
    }
  }

  // Format leads for Supabase
  const finalLeads = [];
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    let foundEmail = "";
    
    if (crawledEmailsMap.has(cand.placeId)) {
      const emailSet = crawledEmailsMap.get(cand.placeId);
      if (emailSet.size > 0) {
        foundEmail = Array.from(emailSet)[0];
        console.log(`[Crawlee] Discovered email for "${cand.businessName}": ${foundEmail}`);
      }
    }

    let emailStatus = "unknown";
    if (foundEmail) {
      emailStatus = await validateEmail(foundEmail);
    }

    finalLeads.push({
      business: cand.businessName,
      industry: query.split(" in ")[0] || "General Scrape",
      location: cand.address,
      email: foundEmail || null,
      has_website: !!cand.website,
      email_status: emailStatus,
      qualification: "pending",
      stage: "scraped",
      source: "scraper",
      source_place_id: cand.placeId,
      raw_scrape: cand.raw
    });
  }

  // Upsert to Supabase
  console.log(`[Database] Upserting ${finalLeads.length} leads to Supabase...`);
  try {
    const { data, error } = await supabase
      .from("leads")
      .upsert(finalLeads, { onConflict: "source_place_id" })
      .select();

    if (error) throw error;
    console.log(`[Database] Upserted ${data?.length || 0} leads successfully.`);
    return data?.length || 0;
  } catch (err) {
    console.error("[Database] Upsert error:", err.message);
    return 0;
  }
}

async function run() {
  let targetQueries = [];

  if (RAW_QUERY) {
    targetQueries = RAW_QUERY.split(",").map((q) => q.trim()).filter(Boolean);
  } else {
    targetQueries = buildQueryList(REGION_PARAM, SECTOR_PARAM, 10);
  }

  console.log(`\n========================================`);
  console.log(`[Pitchline Scraper] Starting Global Sweep`);
  console.log(`[Target Queries]:`, targetQueries);
  console.log(`========================================\n`);

  let totalUpserted = 0;
  for (const query of targetQueries) {
    const count = await scrapeSingleQuery(query);
    totalUpserted += count;
  }

  console.log(`\n========================================`);
  console.log(`[Global Sweep Finished] Total leads upserted: ${totalUpserted}`);
  console.log(`========================================\n`);
}

run();
