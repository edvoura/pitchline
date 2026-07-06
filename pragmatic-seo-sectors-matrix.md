# Pitchline — Pragmatic SEO & Global Lead Scraper Strategy

This document defines the zero-cost global lead harvesting engine, high-intent sector matrix, free-tier API integrations, and 1-click outreach architecture.

---

## 1. Zero-Cost API Stack (Free Tier Limits)

All tools in this stack operate within free monthly allocations with **$0 out-of-pocket cost**:

| Provider | Purpose | Free Allocation | Notes |
| :--- | :--- | :--- | :--- |
| **Resend API** | 1-Click Cold Email Outreach | **3,000 emails / month** (100 / day) | 100% free; no credit card required. |
| **Google Places API** | Global Place & Phone Scrape | **$200 credit / month** (~10,000 queries) | Official Google Maps business details. |
| **Apify Store** | Google Maps / Contact Scraper | **$5.00 credit / month** (~1,500 leads) | Backup scraper actor (`compass/crawler-google-places`). |
| **SERP API** | Google Local Pack / SERP Scrape | **100 searches / month** | Backup local SERP scraper. |
| **Crawlee + Cheerio** | Deep Website Email Extraction | **Unlimited (Self-Hosted)** | Runs inside GitHub Actions / local runner. |
| **Supabase** | CRM, Demos & Database | **500 MB DB / 1 GB Storage** | Holds ~100,000 leads and previews for free. |

---

## 2. Pragmatic SEO: High-Intent Sectors Matrix

These sectors are selected based on **high transaction value, outdated current websites, and strong ROI from a redesigned site/app**:

### Category 1: Healthcare & Dental
* **Sectors:** Dentists, Orthodontists, MedSpas, Chiropractic Clinics, Physiotherapy.
* **Why:** High patient lifetime value ($2,000+). They need online booking, trust signals, and clean appointment funnels.

### Category 2: Home Services & Contracting
* **Sectors:** Roofing Contractors, HVAC Repair, Plumbing Services, Solar Installers, Electricians.
* **Why:** High ticket prices ($5,000–$25,000). Usually have ancient websites or no mobile optimization.

### Category 3: Dining & Hospitality
* **Sectors:** Fine Dining Restaurants, Artisanal Bakeries, Boutique Cafes, Event Catering.
* **Why:** Need modern visual menus, online reservations, and mobile-first experience.

### Category 4: Professional Services
* **Sectors:** Accounting Firms, Tax Consultants, Corporate Law, Real Estate Agencies, Wealth Management.
* **Why:** High trust requirements; outdated designs hurt lead conversion immediately.

---

## 3. Global Geographic Scope (Target Cities)

* **Nigeria:** Lagos (Ikeja, Lekki, Victoria Island), Abuja (Maitama, Wuse), Port Harcourt.
* **United Kingdom:** London, Manchester, Birmingham, Leeds, Glasgow.
* **United States:** New York, Los Angeles, Chicago, Houston, Dallas, Atlanta, Miami.
* **Canada:** Toronto, Vancouver, Calgary, Montreal.

---

## 4. 1-Click Outreach Architecture (Resend Integration)

1. **Trigger:** Click **"Send Email to Prospect"** in the Preview screen.
2. **Payload:** Assembles personalized SNAP email copy (Story → Need → Answer → Proof) with the generated demo link.
3. **Execution:** Dispatches via `sendOutreachEmail` server route utilizing Resend API.
4. **Pipeline Sync:** Automatically updates the lead stage to `"sent"` and logs `dateSent` in Supabase.
