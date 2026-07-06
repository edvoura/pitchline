/**
 * Global Target Sector & Location Matrix for Pitchline Scraper
 */

export const TARGET_SECTORS = [
  "dentists",
  "roofing contractors",
  "hvac repair",
  "plumbing services",
  "restaurants",
  "medspas",
  "accounting firms",
  "law firms",
  "real estate agencies",
  "physiotherapy clinics"
];

export const TARGET_REGIONS = {
  nigeria: ["Ikeja, Lagos", "Lekki, Lagos", "Maitama, Abuja", "Port Harcourt"],
  uk: ["London", "Manchester", "Birmingham", "Leeds"],
  usa: ["New York, NY", "Los Angeles, CA", "Houston, TX", "Chicago, IL", "Miami, FL"],
  canada: ["Toronto, ON", "Vancouver, BC", "Calgary, AB"]
};

/**
 * Generate a list of search queries for a specific region or all regions
 */
export function buildQueryList(region = "all", sector = "all", limit = 10) {
  const selectedSectors = sector === "all" ? TARGET_SECTORS : [sector];
  let selectedCities = [];

  if (region === "all") {
    Object.values(TARGET_REGIONS).forEach((cities) => {
      selectedCities.push(...cities);
    });
  } else if (TARGET_REGIONS[region.toLowerCase()]) {
    selectedCities = TARGET_REGIONS[region.toLowerCase()];
  } else {
    selectedCities = [region]; // Treat custom region input as literal city name
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
