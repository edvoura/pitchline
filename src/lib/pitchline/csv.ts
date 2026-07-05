import type { EmailStatus, Lead } from "./types";

export interface ParseResult {
  leads: Lead[];
  errors: string[];
  totalRows: number;
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas, newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    // Ignore fully empty trailing rows
    if (row.length > 1 || row[0].trim() !== "") rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // swallow, handle \r\n
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) pushRow();
  return rows;
}

const HEADER_ALIASES: Record<string, keyof Lead | "hasWebsite" | "emailStatus"> = {
  business: "business",
  name: "business",
  company: "business",
  "business name": "business",
  industry: "industry",
  category: "industry",
  location: "location",
  city: "location",
  address: "location",
  email: "email",
  "email address": "email",
  website: "hasWebsite",
  "has website": "hasWebsite",
  url: "hasWebsite",
  site: "hasWebsite",
  "email status": "emailStatus",
  notes: "notes",
  note: "notes",
};

function toEmailStatus(v: string): EmailStatus {
  const s = v.trim().toLowerCase();
  if (["valid", "verified", "ok", "true", "yes"].includes(s)) return "valid";
  if (["invalid", "bounce", "bad", "false", "no"].includes(s)) return "invalid";
  return "unknown";
}

function toHasWebsite(v: string): boolean {
  const s = v.trim().toLowerCase();
  if (s === "" || ["no", "none", "false", "0"].includes(s)) return false;
  return true; // any URL / "yes" / "true"
}

function genId(): string {
  return `ld_${Math.random().toString(36).slice(2, 9)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseLeadsCsv(text: string): ParseResult {
  const errors: string[] = [];
  const rows = parseCsv(text.trim());
  if (rows.length === 0) return { leads: [], errors: ["File is empty."], totalRows: 0 };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const hasHeader = header.some((h) => h in HEADER_ALIASES);

  // Build a column -> field map. If no recognizable header, assume a fixed order.
  const colMap: (keyof Lead | "hasWebsite" | "emailStatus" | null)[] = hasHeader
    ? header.map((h) => HEADER_ALIASES[h] ?? null)
    : ["business", "industry", "location", "email", "hasWebsite", "notes"];

  const dataRows = hasHeader ? rows.slice(1) : rows;
  const today = new Date().toISOString().slice(0, 10);
  const leads: Lead[] = [];

  dataRows.forEach((cells, idx) => {
    const rowNo = idx + (hasHeader ? 2 : 1);
    const get = (field: string): string => {
      const at = colMap.indexOf(field as (typeof colMap)[number]);
      return at >= 0 ? (cells[at] ?? "").trim() : "";
    };

    const business = get("business");
    if (!business) {
      errors.push(`Row ${rowNo}: missing business name — skipped.`);
      return;
    }
    const email = get("email");
    const rawStatus = get("emailStatus");
    let emailStatus: EmailStatus = rawStatus ? toEmailStatus(rawStatus) : "unknown";
    if (!rawStatus && email) emailStatus = EMAIL_RE.test(email) ? "valid" : "invalid";

    leads.push({
      id: genId(),
      business,
      industry: get("industry") || "Uncategorized",
      location: get("location") || "—",
      email,
      hasWebsite: toHasWebsite(get("hasWebsite")),
      emailStatus,
      qualification: "pending",
      stage: "scraped",
      dateScraped: today,
      notes: get("notes"),
    });
  });

  return { leads, errors, totalRows: dataRows.length };
}

const CSV_HEADERS = [
  "business",
  "industry",
  "location",
  "email",
  "hasWebsite",
  "emailStatus",
  "qualification",
  "stage",
  "dateScraped",
  "dateSent",
  "notes",
] as const;

function esc(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function leadsToCsv(leads: Lead[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const l of leads) {
    lines.push(
      [
        l.business,
        l.industry,
        l.location,
        l.email,
        l.hasWebsite ? "yes" : "no",
        l.emailStatus,
        l.qualification,
        l.stage,
        l.dateScraped,
        l.dateSent ?? "",
        l.notes ?? "",
      ]
        .map((v) => esc(String(v)))
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Dedupe candidate leads against existing ones by business+email (case-insensitive). */
export function dedupeLeads(
  incoming: Lead[],
  existing: Lead[],
): { unique: Lead[]; duplicates: number } {
  const key = (l: Lead) => `${l.business.toLowerCase()}|${l.email.toLowerCase()}`;
  const seen = new Set(existing.map(key));
  const unique: Lead[] = [];
  let duplicates = 0;
  for (const l of incoming) {
    const k = key(l);
    if (seen.has(k)) {
      duplicates++;
      continue;
    }
    seen.add(k);
    unique.push(l);
  }
  return { unique, duplicates };
}
