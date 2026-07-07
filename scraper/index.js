import { createClient } from "@supabase/supabase-js";
import { CheerioCrawler } from "crawlee";
import dotenv from "dotenv";
import { buildQueryList } from "./matrix.js";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "../.env.local") });

const APIFY_API_KEY = process.env.APIFY_API_KEY || process.env.apify_api;
const SERP_API_KEY = process.env.SERP_API_KEY || process.env.serp_api;
const MAILBOXLAYER_API_KEY = process.env.MAILBOXLAYER_API_KEY || process.env.mailboxlayer_api;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

// Brand Intelligence Extraction
function extractBrandIntel($, pageUrl) {
  const brand = { colors: null, logoUrl: null, fonts: null, tone: null };
  
  // --- COLORS ---
  // 1. Check <meta name="theme-color">
  const themeColor = $('meta[name="theme-color"]').attr('content');
  const colorSet = new Map(); // hex -> count
  if (themeColor && /^#[0-9a-fA-F]{3,6}$/.test(themeColor.trim())) {
    colorSet.set(themeColor.trim().toLowerCase(), 10); // high weight
  }
  
  // 2. Scan inline styles and style blocks for hex/rgb colors
  const colorRegex = /#(?:[0-9a-fA-F]{3}){1,2}/g;
  const neutrals = new Set(['#fff', '#ffffff', '#000', '#000000', '#ccc', '#cccccc', '#ddd', '#dddddd', '#eee', '#eeeeee', '#f5f5f5', '#fafafa', '#333', '#333333', '#666', '#666666', '#999', '#999999', '#aaa', '#aaaaaa', '#bbb', '#bbbbbb']);
  
  const styleContent = $('style').text() + ' ' + $('[style]').map((_, el) => $(el).attr('style') || '').get().join(' ');
  const matches = styleContent.match(colorRegex) || [];
  for (const c of matches) {
    const normalized = c.toLowerCase().length === 4 
      ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] 
      : c.toLowerCase();
    if (!neutrals.has(normalized)) {
      colorSet.set(normalized, (colorSet.get(normalized) || 0) + 1);
    }
  }
  
  if (colorSet.size > 0) {
    brand.colors = [...colorSet.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hex]) => hex);
  }
  
  // --- LOGO ---
  const appleTouchIcon = $('link[rel="apple-touch-icon"]').attr('href');
  const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');
  const logoImg = $('img[src*="logo"], img[alt*="logo" i], img[class*="logo" i]').first().attr('src');
  
  const rawLogo = appleTouchIcon || logoImg || favicon;
  if (rawLogo) {
    try {
      brand.logoUrl = new URL(rawLogo, pageUrl).href;
    } catch {
      brand.logoUrl = rawLogo;
    }
  }
  
  // --- FONTS ---
  const fontNames = new Set();
  // Google Fonts links
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const familyMatch = href.match(/family=([^&]+)/);
    if (familyMatch) {
      familyMatch[1].split('|').forEach(f => {
        const name = decodeURIComponent(f.split(':')[0].replace(/\+/g, ' '));
        if (name) fontNames.add(name);
      });
    }
  });
  // font-family in styles
  const fontFamilyRegex = /font-family:\s*['"]?([^;'"}{]+)/gi;
  let fm;
  while ((fm = fontFamilyRegex.exec(styleContent)) !== null) {
    const firstFont = fm[1].split(',')[0].trim().replace(/['"]|!important/g, '');
    if (firstFont && !['inherit', 'initial', 'sans-serif', 'serif', 'monospace', 'cursive', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI'].includes(firstFont)) {
      fontNames.add(firstFont);
    }
  }
  if (fontNames.size > 0) {
    brand.fonts = [...fontNames].slice(0, 2);
  }
  
  // --- TONE (text extraction for AI) ---
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const h1 = $('h1').first().text().trim();
  const aboutText = $('section, div').filter((_, el) => {
    const text = $(el).attr('class') || '';
    return /about|hero|intro/i.test(text);
  }).first().text().trim().substring(0, 300);
  brand.tone = [title, metaDesc, h1, aboutText].filter(Boolean).join(' | ').substring(0, 500);
  
  return brand;
}

// AI-powered brand tone summarization via Gemini
async function summarizeBrandTone(rawTextSignals) {
  if (!GEMINI_API_KEY || !rawTextSignals || rawTextSignals.length < 10) {
    return null;
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Based on the following text from a business website, summarize this business's brand voice in one sentence (e.g. "warm and approachable", "sleek and professional", "playful and bold"). Output ONLY the one-sentence summary, nothing else.\n\nText: ${rawTextSignals.substring(0, 500)}`
          }]
        }],
        generationConfig: { maxOutputTokens: 60, temperature: 0.2 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (err) {
    console.warn("[BrandIntel] Tone summarization failed:", err.message);
    return null;
  }
}

// ─── OpenStreetMap Overpass API — Primary Business Discovery Source ───────────
// Free, no signup, no API key required.
// Endpoint: https://overpass-api.de/api/interpreter
// Maps Pitchline sector names to OSM tag filters for Overpass QL queries.

const OSM_TAG_MAP = {
  // Healthcare & Wellness
  "dentists":                ['["amenity"="dentist"]'],
  "medspas":                 ['["shop"="beauty"]["beauty"="spa"]', '["leisure"="spa"]'],
  "physiotherapy clinics":   ['["healthcare"="physiotherapist"]'],
  "chiropractors":           ['["healthcare"="chiropractor"]'],
  "optometrists":            ['["healthcare"="optometrist"]', '["shop"="optician"]'],

  // Finance & Professional Services
  "accounting firms":        ['["office"="accountant"]'],
  "tax consultants":         ['["office"="tax_advisor"]', '["office"="accountant"]'],
  "wealth management":       ['["office"="financial_advisor"]', '["office"="financial"]'],
  "insurance agencies":      ['["office"="insurance"]'],

  // Education & Training
  "private schools":         ['["amenity"="school"]["operator:type"="private"]', '["amenity"="school"]'],
  "driving schools":         ['["amenity"="driving_school"]'],
  "coding bootcamps":        ['["amenity"="training"]', '["amenity"="college"]'],
  "language academies":      ['["amenity"="language_school"]'],

  // Legal & Corporate
  "law firms":               ['["office"="lawyer"]'],
  "immigration lawyers":     ['["office"="lawyer"]'],
  "corporate consultants":   ['["office"="consulting"]', '["office"="company"]'],

  // Real Estate & Property
  "real estate agencies":    ['["office"="estate_agent"]'],
  "property management":     ['["office"="estate_agent"]'],
  "interior designers":      ['["office"="architect"]', '["shop"="interior_decoration"]'],
  "architecture firms":      ['["office"="architect"]'],

  // Home Services & Construction
  "roofing contractors":     ['["craft"="roofer"]'],
  "hvac repair":             ['["craft"="hvac"]'],
  "plumbing services":       ['["craft"="plumber"]'],
  "electricians":            ['["craft"="electrician"]'],
  "solar installers":        ['["craft"="photovoltaic"]', '["shop"="energy"]'],

  // Beauty, Personal Care & Fitness
  "hair salons":             ['["shop"="hairdresser"]'],
  "barbershops":             ['["shop"="hairdresser"]', '["amenity"="barber"]'],
  "fitness gyms":            ['["leisure"="fitness_centre"]'],
  "yoga studios":            ['["leisure"="fitness_centre"]["sport"="yoga"]', '["sport"="yoga"]'],

  // Hospitality & Food
  "restaurants":             ['["amenity"="restaurant"]'],
  "boutique cafes":          ['["amenity"="cafe"]'],
  "event caterers":          ['["craft"="caterer"]'],

  // Automotive & Logistics
  "auto repair shops":       ['["shop"="car_repair"]'],
  "car detailing":           ['["shop"="car_repair"]', '["amenity"="car_wash"]'],
  "logistics companies":     ['["office"="logistics"]', '["office"="courier"]'],
};

/**
 * Build an Overpass QL query string from a human-readable category + location.
 * Uses area name matching (case-insensitive) so "Lagos", "London", etc. resolve
 * to the corresponding OSM administrative boundary.
 */
function buildOverpassQuery(category, location) {
  const tagFilters = OSM_TAG_MAP[category.toLowerCase()];

  // Fallback: if no tag mapping exists, do a fuzzy name search across all POIs
  if (!tagFilters) {
    console.warn(`[Overpass] No OSM tag mapping for "${category}", falling back to name search`);
    return `[out:json][timeout:30];
area["name"~"${location}",i]->.searchArea;
(
  node["name"~"${category}",i](area.searchArea);
  way["name"~"${category}",i](area.searchArea);
);
out center tags;`;
  }

  // Build union of node+way queries for each tag filter
  const queryParts = tagFilters.flatMap((filter) => [
    `  node${filter}(area.searchArea);`,
    `  way${filter}(area.searchArea);`,
  ]);

  return `[out:json][timeout:30];
area["name"~"${location}",i]->.searchArea;
(
${queryParts.join("\n")}
);
out center tags;`;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

async function fetchOverpassCandidates(query) {
  const parts = query.split(" in ");
  const category = (parts[0] || query).trim();
  const location = (parts[1] || "").trim();

  if (!location) {
    console.warn(`[Overpass] No location found in query "${query}", skipping`);
    return [];
  }

  const overpassQL = buildOverpassQuery(category, location);
  
  let res = null;
  let data = null;
  
  for (const endpoint of OVERPASS_ENDPOINTS) {
    console.log(`[Overpass] Querying OSM endpoint: ${endpoint} for "${category}" in "${location}"...`);
    
    // Respect Overpass fair-use policy: 1.5s delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    try {
      const response = await fetchWithRetry(
        endpoint,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "PitchlineScraper/1.0 (https://github.com/4poesy/pitchline; contact@pitchline.dev)",
            "Accept": "application/json"
          },
          body: `data=${encodeURIComponent(overpassQL)}`,
        },
        1, // 1 retry per endpoint to not hang too long
        2000
      );
      
      if (response.ok) {
        data = await response.json();
        res = response;
        break; // Successfully got data, stop trying other endpoints
      } else {
        console.warn(`[Overpass] Endpoint ${endpoint} returned status ${response.status}`);
      }
    } catch (err) {
      console.warn(`[Overpass] Endpoint ${endpoint} query failed: ${err.message}`);
    }
  }

  if (!res || !data) {
    console.error("[Overpass] All Overpass API endpoints failed or rate-limited.");
    return [];
  }

  const elements = data.elements || [];

  // Filter out unnamed elements — they're useless as business leads
  const named = elements.filter((el) => el.tags?.name);

  console.log(`[Overpass] Found ${named.length} named businesses (${elements.length} total elements)`);

  return named.slice(0, MAX_PLACES).map((el) => {
    const tags = el.tags || {};

    // Build readable address from addr:* tags
    const addrParts = [
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:city"],
      tags["addr:state"],
      tags["addr:postcode"],
      tags["addr:country"],
    ].filter(Boolean);
    const address = addrParts.length > 0 ? addrParts.join(", ") : (tags["addr:full"] || "—");

    // Phone: check multiple OSM tag conventions
    const phone = tags.phone || tags["contact:phone"] || tags["phone:mobile"] || "";

    // Website: check multiple OSM tag conventions
    const website = tags.website || tags["contact:website"] || tags.url || "";

    return {
      placeId: `osm_${el.type}/${el.id}`,
      businessName: tags.name,
      address,
      phone,
      website,
      raw: el,
    };
  });
}

// ─── Paid API Fallback Fetchers (optional, gated on their own API keys) ──────

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

  // Primary source: OpenStreetMap Overpass API (free, no key required)
  try {
    candidates = await fetchOverpassCandidates(query);
  } catch (err) {
    console.warn(`[Overpass] Failed to fetch candidates: ${err.message} (Reason: ${err.reason || "unknown"})`);
  }

  // Fallback 1: Apify Scraper API (paid, optional)
  if (candidates.length === 0 && APIFY_API_KEY && !rateLimitStops) {
    try {
      candidates = await fetchApifyCandidates(query);
    } catch (err) {
      console.warn(`[Apify] Failed to fetch candidates: ${err.message} (Reason: ${err.reason || "unknown"})`);
    }
  }

  // Fallback 2: SerpAPI (paid, optional)
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
    console.error(`[Scraper] All harvesting APIs failed or returned no results for: "${query}".`);
    runStats.leadsSkippedFetchFailed += MAX_PLACES;
    return 0;
  }

  runStats.businessesFound = candidates.length;

  // Crawl websites using Crawlee
  const urlsToCrawl = candidates
    .filter((c) => c.website)
    .map((c) => ({ url: c.website, placeId: c.placeId }));

  const crawledEmailsMap = new Map();
  const crawledBrandMap = new Map();

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

        // Brand intelligence extraction
        const brandIntel = extractBrandIntel($, request.url);
        request.userData.brandIntel = brandIntel;
        if (!crawledBrandMap.has(placeId)) {
          crawledBrandMap.set(placeId, brandIntel);
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

    // AI-enrich brand tone summaries for crawled brands
    if (GEMINI_API_KEY) {
      for (const [placeId, brand] of crawledBrandMap.entries()) {
        if (brand?.tone && brand.tone.length > 10) {
          const aiTone = await summarizeBrandTone(brand.tone);
          if (aiTone) {
            brand.tone = aiTone;
            crawledBrandMap.set(placeId, brand);
          }
        }
      }
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
    
    // Determine preferred channel using priority: email > whatsapp > call
    let preferredChannel = "call"; // default: manual follow-up needed
    let noContactNote = "";
    if (foundEmail) {
      preferredChannel = "email";
    } else if (normalizedPhone) {
      preferredChannel = "whatsapp";
    } else if (!existing?.email && !existing?.phone) {
      noContactNote = "No contact info found — manual research needed";
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

    // Brand intelligence: use website-crawled data when available
    const brandData = crawledBrandMap.get(cand.placeId);
    const brandSource = cand.website ? 'website' : 'none';

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
      notes: noContactNote || "",
      date_scraped: new Date().toISOString().split("T")[0],
      source: "scraper",
      source_place_id: cand.placeId,
      raw_scrape: cand.raw,
      brand_colors: brandData?.colors || null,
      brand_logo_url: brandData?.logoUrl || null,
      brand_fonts: brandData?.fonts || null,
      brand_tone_summary: brandData?.tone || null,
      brand_source: brandSource,
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
