import { createClient } from "@supabase/supabase-js";
import { CheerioCrawler } from "crawlee";
import dotenv from "dotenv";
import { buildQueryList } from "./matrix.js";

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.PLACES_API_KEY;
const APIFY_API_KEY = process.env.APIFY_API_KEY || process.env.apify_api;
const SERP_API_KEY = process.env.SERP_API_KEY || process.env.serp_api;
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Regex to extract emails
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function isValidEmailPattern(email) {
  const lowercase = email.toLowerCase();
  const invalidExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"];
  const invalidDomains = ["example.com", "yourdomain.com", "domain.com", "email.com", "sentry.io", "wix.com"];

  if (invalidExtensions.some((ext) => lowercase.endsWith(ext))) return false;
  if (invalidDomains.some((dom) => lowercase.includes(dom))) return false;

  return true;
}

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

/**
 * Fetch candidates using Google Places API
 */
async function fetchGooglePlacesCandidates(query) {
  console.log(`[Places] Querying Google Places API...`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status === "REQUEST_DENIED") throw new Error(data.error_message || "Denied");

  const results = data.results || [];
  return results.slice(0, MAX_PLACES).map((item) => ({
    placeId: item.place_id,
    businessName: item.name,
    address: item.formatted_address || "—",
    phone: item.formatted_phone_number || "",
    website: item.website || "",
    raw: item
  }));
}

/**
 * Fetch candidates using Apify Google Maps Scraper (Free $5 Credits)
 */
async function fetchApifyCandidates(query) {
  console.log(`[Apify] Querying Google Maps Scraper Actor...`);
  const runUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchStrings: [query],
      maxPlacesPerSearch: MAX_PLACES,
      exportPlaceUrls: false
    })
  });
  if (!res.ok) throw new Error(`Apify returned HTTP ${res.status}`);
  const results = await res.json();

  return (results || []).slice(0, MAX_PLACES).map((item, index) => ({
    placeId: item.placeId || `apify_${Date.now()}_${index}`,
    businessName: item.title || item.name,
    address: item.address || item.street || "—",
    phone: item.phone || "",
    website: item.website || "",
    raw: item
  }));
}

/**
 * Fetch candidates using SerpAPI Google Maps engine (Free 100 searches/mo)
 */
async function fetchSerpApiCandidates(query) {
  console.log(`[SerpAPI] Querying Local Pack / Maps search...`);
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI returned HTTP ${res.status}`);
  const data = await res.json();

  const results = data.local_results || data.places || [];
  return results.slice(0, MAX_PLACES).map((item, index) => ({
    placeId: item.place_id || item.gps_coordinates?.latitude + "_" + item.gps_coordinates?.longitude || `serp_${Date.now()}_${index}`,
    businessName: item.title || item.name,
    address: item.address || "—",
    phone: item.phone || "",
    website: item.website || "",
    raw: item
  }));
}

async function scrapeSingleQuery(query) {
  console.log(`\n========================================`);
  console.log(`[Scraper] Processing: "${query}"`);
  console.log(`========================================`);

  let candidates = [];

  // Try Google Places API first
  if (GOOGLE_PLACES_API_KEY) {
    try {
      candidates = await fetchGooglePlacesCandidates(query);
    } catch (err) {
      console.warn(`[Places] Failed to fetch via Google Places (${err.message}). Trying fallbacks...`);
    }
  }

  // Fallback 1: Apify Scraper API
  if (candidates.length === 0 && APIFY_API_KEY) {
    try {
      candidates = await fetchApifyCandidates(query);
    } catch (err) {
      console.warn(`[Apify] Failed to fetch via Apify (${err.message}). Trying fallbacks...`);
    }
  }

  // Fallback 2: SerpAPI
  if (candidates.length === 0 && SERP_API_KEY) {
    try {
      candidates = await fetchSerpApiCandidates(query);
    } catch (err) {
      console.error(`[SerpAPI] Failed to fetch via SerpAPI:`, err.message);
    }
  }

  if (candidates.length === 0) {
    console.error(`[Scraper] All harvesting APIs failed or were not configured for: "${query}".`);
    return 0;
  }

  // Resolve additional website details if Google Places was used and website was missing
  if (GOOGLE_PLACES_API_KEY) {
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (!cand.website) {
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
          // ignore details failure
        }
      }
    }
  }

  // Crawl websites using Crawlee
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
        // quiet failure logs
      }
    });

    const initialRequests = urlsToCrawl.map((item) => ({
      url: item.url,
      userData: { placeId: item.placeId }
    }));

    try {
      await crawler.run(initialRequests);
    } catch (err) {
      console.warn("[Crawlee] Crawler run notice:", err.message);
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
    targetQueries = buildQueryList(REGION_PARAM, SECTOR_PARAM, 15);
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
