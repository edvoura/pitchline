import type { Template } from "./types";

// Starter template presets — style scaffolding, not mock business data.
// Seeded on first boot if the templates table is empty.
export const STARTER_TEMPLATES: Template[] = [
  {
    id: "tpl_001",
    name: "Restaurant — Warm / Luxury",
    description: "Appetite-driven, editorial, warm neutrals with rich imagery.",
    mood: "luxury",
    layoutStyle: "asymmetric / full-bleed",
    typography: "editorial serif",
    colorDirection: "earthy natural",
    animation: "subtle",
    sections: ["Hero", "Features", "Social Proof", "CTA", "Closing"],
  },
  {
    id: "tpl_002",
    name: "SaaS — Minimal / Futuristic",
    description: "Product-forward, high-contrast dark, crisp technical type.",
    mood: "futuristic",
    layoutStyle: "grid / contained",
    typography: "mono-accented technical",
    colorDirection: "high-contrast dark",
    animation: "expressive",
    sections: ["Hero", "Features", "Social Proof", "CTA"],
  },
  {
    id: "tpl_003",
    name: "Home Services — Bold / Trust",
    description: "Direct, conversion-first, strong CTAs and proof.",
    mood: "bold",
    layoutStyle: "grid / contained",
    typography: "clean sans-serif",
    colorDirection: "monochrome + single accent",
    animation: "subtle",
    sections: ["Hero", "Features", "Social Proof", "CTA", "Closing"],
  },
  {
    id: "tpl_004",
    name: "Wellness — Calm / Minimal",
    description: "Airy, soft, humanist type with generous whitespace.",
    mood: "minimal",
    layoutStyle: "asymmetric / contained",
    typography: "humanist warm",
    colorDirection: "warm neutrals",
    animation: "subtle",
    sections: ["Hero", "Features", "CTA", "Closing"],
  },
];
