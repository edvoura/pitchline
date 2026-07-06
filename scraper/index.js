import { createClient } from "@supabase/supabase-js";
import { CheerioCrawler } from "crawlee";
import dotenv from "dotenv";
import { buildQueryList } from "./matrix.js";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env.local") });

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.PLACES_API_KEY || process.env.google_places_api_key || process.env.places_api_key;
const APIFY_API_KEY = process.env.APIFY_API_KEY || process.env.apify_api;
const SERP_API_KEY = process.env.SERP_API_KEY || process.env.serp_api;
const MAILBOXLAYER_API_KEY = process.env.MAILBOXLAYER_API_KEY || process.env.mailboxlayer_api;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const API_HOST = process.env.API_HOST || "https://pitchline-psi.vercel.app";

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

// Stats Tracking (Global)
const runStats = {
  query: "",
  location: "",
  businessesFound: 0,
  leadsWrittenNew: 0,
  leadsUpdatedExisting: 0,
  leadsSkippedNoContact: 0,
  leadsSkippedFetchFailed: 0,
  emailsFound: 0,
  phonesFound: 0,
  whatsappLinksGenerated: 0,
  rateLimitStops: "N",
  mailboxlayerRateLimited: false,
};

// Regex and Validation Helpers
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function isValidEmailPattern(email) {
  if (!email || !email.includes("@") || !email.includes(".")) return false;
  const lowercase = email.toLowerCase();
  const invalidExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".ico", ".woff", ".woff2"];
  const invalidDomains = ["example.com", "yourdomain.com", "domain.com", "email.com", "sentry.io", "wix.com", "google.com"];

  if (invalidExtensions.some((ext) => lowercase.endsWith(ext))) return false;
  if (invalidDomains.some((dom) => lowercase.includes(dom))) return false;

  return true;
}

// Retry & Backoff helper
async function fetchWithRetry(url, options = {}, retries = 2, delay = 2000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      if (i === retries) {
        throw err;
      }
      console.warn(`[Retry] Fetch failed (${err.message}). Retrying in ${delay / 1000}s... (Attempt ${i + 1}/${retries + 1})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = delay === 2000 ? 5000 : delay * 2; // backoff: 2s, then 5s
    }
  }
}

// Mailboxlayer validator with rate limit awareness
async function validateEmail(email) {
  if (!MAILBOXLAYER_API_KEY || runStats.mailboxlayerRateLimited) {
    return { status: "unknown", rateLimited: false };
  }
  try {
    const res = await fetchWithRetry(
      `http://apilayer.net/api/check?access_key=${MAILBOXLAYER_API_KEY}&email=${encodeURIComponent(email)}`,
      {},
      1,
      2000
    );
    if (!res.ok) {
      if (res.status === 429) return { status: "unknown", rateLimited: true };
      return { status: "unknown", rateLimited: false };
    }
    const payload = await res.json();
    if (payload.success === false) {
      const code = payload.error?.code;
      if (code === 104 || code === 210 || code === 404) {
        console.warn(`[Mailboxlayer] Usage/Rate limit reached: ${payload.error?.info}`);
        return { status: "unknown", rateLimited: true };
      }
      return { status: "unknown", rateLimited: false };
    }
    const isValid = payload.format_valid && payload.mx_found;
    return { status: isValid ? "valid" : "invalid", rateLimited: false };
  } catch (err) {
    console.warn(`[Mailboxlayer] Validation check failed:`, err.message);
    return { status: "unknown", rateLimited: false };
  }
}

// Phone normalization helper (7-15 digits)
function normalizePhoneNumber(phone, locationContext = "") {
  if (!phone) return "";
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return "";

  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return ""; // Invalid digit length
  }

  if (cleaned.startsWith("+")) {
    return cleaned.replace("+", "");
  }

  if (cleaned.startsWith("0")) {
    let countryCode = "234"; // Default Nigeria
    if (locationContext.toLowerCase().includes("us") || locationContext.toLowerCase().includes("united states")) {
      countryCode = "1";
    } else if (locationContext.toLowerCase().includes("uk") || locationContext.toLowerCase().includes("united kingdom")) {
      countryCode = "44";
    }
    return countryCode + cleaned.substring(1);
  }

  return cleaned;
}

// Harvesting Candidate fetchers with retry and rate-limit detection
async function fetchGooglePlacesCandidates(query) {
  console.log(`[Places] Querying Google Places API...`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
  
  let res;
  try {
    res = await fetchWithRetry(url, {}, 2, 2000);
  } catch (err) {
    const error = new Error(`Places API fetch failed: ${err.message}`);
    error.reason = "DNS/Connection timeout";
    throw error;
  }

  const data = await res.json();
  if (data.status === "REQUEST_DENIED") {
    const error = new Error(data.error_message || "Denied");
    error.reason = "403 Denied";
    throw error;
  }
  if (data.status === "OVER_QUERY_LIMIT") {
    const error = new Error("Google Places API Over Query Limit");
    error.code = "OVER_QUERY_LIMIT";
    error.reason = "Rate-limited";
    throw error;
  }

  const results = data.results || [];
  return results.slice(0, MAX_PLACES).map((item) => ({
    placeId: item.place_id,
    businessName: item.name,
    address: item.formatted_address || "—",
    phone: item.formatted_phone_number || "",
    website: item.website || "",
    raw: item,
  }));
}

async function fetchApifyCandidates(query) {
  console.log(`[Apify] Querying Google Maps Scraper Actor...`);
  const runUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_API_KEY}`;
  
  let res;
  try {
    res = await fetchWithRetry(runUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStrings: [query],
        maxPlacesPerSearch: MAX_PLACES,
        exportPlaceUrls: false,
      }),
    }, 2, 2000);
  } catch (err) {
    const error = new Error(`Apify Crawler failed: ${err.message}`);
    error.reason = "Crawl failed";
    throw error;
  }

  const results = await res.json();
  return (results || []).slice(0, MAX_PLACES).map((item, index) => ({
    placeId: item.placeId || `apify_${Date.now()}_${index}`,
    businessName: item.title || item.name,
    address: item.address || item.street || "—",
    phone: item.phone || "",
    website: item.website || "",
    raw: item,
  }));
}

async function fetchSerpApiCandidates(query) {
  console.log(`[SerpAPI] Querying Local Pack / Maps search...`);
  const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(query)}&api_key=${SERP_API_KEY}`;
  
  let res;
  try {
    res = await fetchWithRetry(url, {}, 2, 2000);
  } catch (err) {
    const error = new Error(`SerpAPI failed: ${err.message}`);
    error.reason = "Connection failed";
    throw error;
  }

  const data = await res.json();
  if (data.error) {
    const error = new Error(data.error);
    error.reason = data.error.includes("rate") || data.error.includes("limit") ? "Rate-limited" : "Invalid Key";
    throw error;
  }

  const results = data.local_results || data.places || [];
  return results.slice(0, MAX_PLACES).map((item, index) => ({
    placeId: item.place_id || item.gps_coordinates?.latitude + "_" + item.gps_coordinates?.longitude || `serp_${Date.now()}_${index}`,
    businessName: item.title || item.name,
    address: item.address || "—",
    phone: item.phone || "",
    website: item.website || "",
    raw: item,
  }));
}

async function scrapeSingleQuery(query) {
  console.log(`\n========================================`);
  console.log(`[Scraper] Processing: "${query}"`);
  console.log(`========================================`);

  const queryParts = query.split(" in ");
  runStats.query = queryParts[0] || query;
  runStats.location = queryParts[1] || "All regions";

  let candidates = [];
  let rateLimitStops = false;

  // Try Google Places API first
  if (GOOGLE_PLACES_API_KEY && !rateLimitStops) {
    try {
      candidates = await fetchGooglePlacesCandidates(query);
    } catch (err) {
      console.warn(`[Places] Failed to fetch candidates: ${err.message} (Reason: ${err.reason || "unknown"})`);
      if (err.code === "OVER_QUERY_LIMIT") {
        rateLimitStops = true;
        runStats.rateLimitStops = "Y";
      }
    }
  }

  // Fallback 1: Apify Scraper API
  if (candidates.length === 0 && APIFY_API_KEY && !rateLimitStops) {
    try {
      candidates = await fetchApifyCandidates(query);
    } catch (err) {
      console.warn(`[Apify] Failed to fetch candidates: ${err.message} (Reason: ${err.reason || "unknown"})`);
    }
  }

  // Fallback 2: SerpAPI
  if (candidates.length === 0 && SERP_API_KEY && !rateLimitStops) {
    try {
      candidates = await fetchSerpApiCandidates(query);
    } catch (err) {
      console.warn(`[SerpAPI] Failed to fetch candidates: ${err.message} (Reason: ${err.reason || "unknown"})`);
      if (err.reason === "Rate-limited") {
        rateLimitStops = true;
        runStats.rateLimitStops = "Y";
      }
    }
  }

  if (candidates.length === 0) {
    console.error(`[Scraper] All harvesting APIs failed or rate-limited for: "${query}".`);
    runStats.leadsSkippedFetchFailed += MAX_PLACES;
    return 0;
  }

  runStats.businessesFound = candidates.length;

  // Resolve additional website details if Google Places was used and website was missing
  if (GOOGLE_PLACES_API_KEY && !rateLimitStops) {
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      if (!cand.website) {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${cand.placeId}&fields=website,formatted_phone_number&key=${GOOGLE_PLACES_API_KEY}`;
          const res = await fetchWithRetry(detailsUrl, {}, 2, 2000);
          if (res.ok) {
            const detailData = await res.json();
            if (detailData.result) {
              if (detailData.result.website) cand.website = detailData.result.website;
              if (detailData.result.formatted_phone_number) cand.phone = detailData.result.formatted_phone_number;
            }
          }
        } catch (err) {
          console.warn(`[Places Details] Fetch failed for ${cand.businessName}: ${err.message}`);
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
          },
        });
      },

      failedRequestHandler({ request, error }) {
        console.warn(`[Crawlee] Crawl failed for ${request.url}: ${error.message}`);
      },
    });

    const initialRequests = urlsToCrawl.map((item) => ({
      url: item.url,
      userData: { placeId: item.placeId },
    }));

    try {
      await crawler.run(initialRequests);
    } catch (err) {
      console.warn("[Crawlee] Crawler run notice:", err.message);
    }
  }

  // Query existing database leads to ensure idempotency (don't overwrite valid emails/phones)
  const placeIds = candidates.map((c) => c.placeId);
  const { data: existingLeads, error: selectErr } = await supabase
    .from("leads")
    .select("id, source_place_id, email, phone, whatsapp_link, preferred_channel, stage")
    .in("source_place_id", placeIds);

  if (selectErr) {
    console.warn(`[Database] Failed to select existing leads: ${selectErr.message}`);
  }
  const existingMap = new Map((existingLeads || []).map((l) => [l.source_place_id, l]));

  // Format leads for Supabase
  const finalLeads = [];
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const existing = existingMap.get(cand.placeId);

    let foundEmail = "";
    
    if (crawledEmailsMap.has(cand.placeId)) {
      const emailSet = crawledEmailsMap.get(cand.placeId);
      if (emailSet.size > 0) {
        foundEmail = Array.from(emailSet)[0];
        console.log(`[Crawlee] Discovered email for "${cand.businessName}": ${foundEmail}`);
      }
    }

    // Secondary pass: Enrichment fallback using Vercel Scraper API
    if (!foundEmail && cand.website) {
      console.log(`[Enrichment] Secondary crawl on Vercel scrape API for: ${cand.website}`);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500)); // 1.5s delay
        const res = await fetchWithRetry(
          `${API_HOST}/api/scrape`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: cand.website }),
          },
          1,
          2000
        );
        if (res.ok) {
          const payload = await res.json();
          if (payload.emails && payload.emails.length > 0) {
            const valid = payload.emails.filter(isValidEmailPattern);
            if (valid.length > 0) {
              foundEmail = valid[0].toLowerCase();
              console.log(`[Enrichment] Discovered email via Vercel: ${foundEmail}`);
            }
          }
          if (!cand.phone && payload.phones && payload.phones.length > 0) {
            cand.phone = payload.phones[0];
            console.log(`[Enrichment] Discovered phone via Vercel: ${cand.phone}`);
          }
        }
      } catch (enrichErr) {
        console.warn(`[Enrichment] Secondary crawl failed for ${cand.website}: ${enrichErr.message}`);
      }
    }

    // Email validation
    let emailStatus = "unknown";
    if (foundEmail) {
      const validationResult = await validateEmail(foundEmail);
      emailStatus = validationResult.status;
      if (validationResult.rateLimited) {
        runStats.mailboxlayerRateLimited = true;
        runStats.rateLimitStops = "Y";
      }
    }

    // Normalizations & Validations
    const normalizedPhone = normalizePhoneNumber(cand.phone || "", query);
    const whatsappLink = normalizedPhone ? `https://wa.me/${normalizedPhone}` : null;
    
    // Skip if no contact info at all
    if (!foundEmail && !normalizedPhone && !existing?.email && !existing?.phone) {
      console.log(`[Skip] No valid contact info found for: "${cand.businessName}". Skipping.`);
      runStats.leadsSkippedNoContact++;
      continue;
    }

    // Determine preferred channel
    let preferredChannel = "email";
    if (whatsappLink) {
      preferredChannel = "whatsapp";
    }

    if (foundEmail) runStats.emailsFound++;
    if (normalizedPhone) runStats.phonesFound++;
    if (whatsappLink) runStats.whatsappLinksGenerated++;

    // Idempotence merge logic: Only update if existing is null/empty
    const emailToWrite = existing?.email || foundEmail || null;
    const phoneToWrite = existing?.phone || normalizedPhone || null;
    const whatsappLinkToWrite = existing?.whatsapp_link || whatsappLink || null;
    const channelToWrite = existing?.preferred_channel || preferredChannel;
    
    // Stage logic: keep existing stage, or default to scraped
    const stageToWrite = existing?.stage || "scraped";

    if (existing) {
      runStats.leadsUpdatedExisting++;
    } else {
      runStats.leadsWrittenNew++;
    }

    finalLeads.push({
      business: cand.businessName,
      industry: query.split(" in ")[0] || "General Scrape",
      location: cand.address,
      email: emailToWrite,
      phone: phoneToWrite,
      whatsapp_link: whatsappLinkToWrite,
      preferred_channel: channelToWrite,
      has_website: !!cand.website,
      email_status: emailStatus,
      qualification: "pending",
      stage: stageToWrite,
      source: "scraper",
      source_place_id: cand.placeId,
      raw_scrape: cand.raw,
    });
  }

  if (finalLeads.length === 0) {
    console.log(`[Database] No new or updated leads qualified for writing.`);
    return 0;
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
  console.log(`Run summary:`);
  console.log(`- Query: "${runStats.query}", Location: "${runStats.location}"`);
  console.log(`- Businesses found: ${runStats.businessesFound}`);
  console.log(`- Leads written (new): ${runStats.leadsWrittenNew}`);
  console.log(`- Leads updated (existing): ${runStats.leadsUpdatedExisting}`);
  console.log(`- Leads skipped (reason: no contact info found): ${runStats.leadsSkippedNoContact}`);
  console.log(`- Leads skipped (reason: fetch failed after retries): ${runStats.leadsSkippedFetchFailed}`);
  console.log(`- Emails found: ${runStats.emailsFound} | Phones found: ${runStats.phonesFound} | WhatsApp links generated: ${runStats.whatsappLinksGenerated}`);
  console.log(`- Rate-limit stops: ${runStats.rateLimitStops}`);
  console.log(`========================================\n`);
}

run();
