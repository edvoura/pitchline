export type EmailStatus = "valid" | "invalid" | "unknown";
export type Qualification = "pending" | "qualified" | "rejected";

export type Stage =
  | "scraped"
  | "qualified"
  | "demo_built"
  | "sent"
  | "viewed"
  | "replied"
  | "won"
  | "lost";

export type Provider = "claude" | "gemini";
export type AnimationIntensity = "none" | "subtle" | "expressive";

export interface Lead {
  id: string;
  business: string;
  industry: string;
  location: string;
  email: string;
  hasWebsite: boolean;
  emailStatus: EmailStatus;
  qualification: Qualification;
  stage: Stage;
  dateScraped: string;
  dateSent?: string;
  notes: string;
  followUp?: string;
}

export interface PromptDirection {
  mood: string;
  layoutStyle: string;
  typography: string;
  colorDirection: string;
  animation: AnimationIntensity;
  visualReference: string;
  sections: string[];
  ctaFocus: string;
  // SNAP copy
  story: string;
  need: string;
  answer: string;
  proof: string;
}

export interface PromptRecord extends PromptDirection {
  leadId: string;
  compiled: string;
  provider: Provider;
  updatedAt: string;
}

export interface DemoRecord {
  leadId: string;
  html: string;
  provider: Provider;
  refinements: string[];
  createdAt: string;
  ready: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  mood: string;
  layoutStyle: string;
  typography: string;
  colorDirection: string;
  animation: AnimationIntensity;
  sections: string[];
}

export const STAGES: { id: Stage; label: string; token: string }[] = [
  { id: "scraped", label: "Scraped", token: "var(--status-scraped)" },
  { id: "qualified", label: "Qualified", token: "var(--status-qualified)" },
  { id: "demo_built", label: "Demo Built", token: "var(--status-demo)" },
  { id: "sent", label: "Sent", token: "var(--status-sent)" },
  { id: "viewed", label: "Viewed", token: "var(--status-viewed)" },
  { id: "replied", label: "Replied", token: "var(--status-replied)" },
  { id: "won", label: "Won", token: "var(--status-won)" },
  { id: "lost", label: "Lost", token: "var(--status-lost)" },
];

export const MOODS = [
  "minimal",
  "bold",
  "luxury",
  "dark",
  "futuristic",
  "corporate",
  "playful",
];

export const LAYOUT_STYLES = [
  "grid / contained",
  "grid / full-bleed",
  "asymmetric / contained",
  "asymmetric / full-bleed",
];

export const TYPOGRAPHY_DIRECTIONS = [
  "clean sans-serif",
  "editorial serif",
  "geometric display",
  "mono-accented technical",
  "humanist warm",
];

export const COLOR_DIRECTIONS = [
  "monochrome + single accent",
  "warm neutrals",
  "cool neutrals",
  "high-contrast dark",
  "vibrant duotone",
  "earthy natural",
];

export const SECTION_OPTIONS = [
  "Hero",
  "Features",
  "Social Proof",
  "CTA",
  "Closing",
];
