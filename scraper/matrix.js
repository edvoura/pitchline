/**
 * Global Target Sector Matrix for Pitchline Scraper — Universal Cross-Industry Coverage
 */

export const TARGET_SECTORS = [
  // Healthcare & Wellness
  "dentists",
  "medspas",
  "physiotherapy clinics",
  "chiropractors",
  "optometrists",
  
  // Finance & Professional Services
  "accounting firms",
  "tax consultants",
  "wealth management",
  "insurance agencies",

  // Education & Training
  "private schools",
  "driving schools",
  "coding bootcamps",
  "language academies",

  // Legal & Corporate
  "law firms",
  "immigration lawyers",
  "corporate consultants",

  // Real Estate & Property
  "real estate agencies",
  "property management",
  "interior designers",
  "architecture firms",

  // Home Services & Construction
  "roofing contractors",
  "hvac repair",
  "plumbing services",
  "electricians",
  "solar installers",

  // Beauty, Personal Care & Fitness
  "hair salons",
  "barbershops",
  "fitness gyms",
  "yoga studios",

  // Hospitality & Food
  "restaurants",
  "boutique cafes",
  "event caterers",

  // Automotive & Logistics
  "auto repair shops",
  "car detailing",
  "logistics companies"
];

export const TARGET_REGIONS = {
  nigeria: ["Ikeja, Lagos", "Lekki, Lagos", "Victoria Island, Lagos", "Maitama, Abuja", "Port Harcourt"],
  uk: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow"],
  usa: ["New York, NY", "Los Angeles, CA", "Houston, TX", "Chicago, IL", "Miami, FL", "Atlanta, GA"],
  canada: ["Toronto, ON", "Vancouver, BC", "Calgary, AB", "Montreal, QC"]
};

/**
 * Generate a list of search queries for a specific region or all regions
 */
export function buildQueryList(region = "all", sector = "all", limit = 15) {
  const selectedSectors = sector === "all" ? TARGET_SECTORS : [sector];
  let selectedCities = [];

  if (region === "all") {
    Object.values(TARGET_REGIONS).forEach((cities) => {
      selectedCities.push(...cities);
    });
  } else if (TARGET_REGIONS[region.toLowerCase()]) {
    selectedCities = TARGET_REGIONS[region.toLowerCase()];
  } else {
    selectedCities = [region]; // Custom city string
  }

  const queries = [];
  for (const s of selectedSectors) {
    for (const c of selectedCities) {
      queries.push(`${s} in ${c}`);
      if (queries.length >= limit) break;
    }
    if (queries.length >= limit) break;
  }

  return queries;
}
