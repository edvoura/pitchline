import type { Lead, PromptDirection, Provider } from "./types";

/**
 * Assemble the structured "master template" prompt from a lead + direction.
 * Returns a deterministic, copy-pasteable block.
 */
export function compilePrompt(lead: Lead, d: PromptDirection, images: string[] = []): string {
  const ind = (lead.industry || "").toLowerCase();

  // Industry-guided defaults (Option 2) if operator leaves fields blank
  let defaultMood = "bold";
  let defaultLayout = "grid / contained";
  let defaultTypography = "clean sans-serif";
  let defaultColor = "monochrome + single accent";
  let defaultAnimation = "subtle";

  if (ind.includes("dent") || ind.includes("health") || ind.includes("medic") || ind.includes("clinic")) {
    defaultMood = "corporate / trust";
    defaultTypography = "sans-serif, high legibility";
    defaultColor = "clean white + blue accent";
  } else if (ind.includes("rest") || ind.includes("cafe") || ind.includes("food") || ind.includes("bake")) {
    defaultMood = "warm / luxury";
    defaultTypography = "editorial serif";
    defaultLayout = "asymmetric / full-bleed";
    defaultColor = "earthy natural";
  } else if (ind.includes("saas") || ind.includes("tech") || ind.includes("soft") || ind.includes("app")) {
    defaultMood = "minimal / futuristic";
    defaultTypography = "mono-accented technical";
    defaultColor = "high-contrast dark";
    defaultAnimation = "expressive";
  } else if (ind.includes("well") || ind.includes("spa") || ind.includes("yoga") || ind.includes("care")) {
    defaultMood = "minimal / calm";
    defaultTypography = "humanist warm";
    defaultLayout = "asymmetric / contained";
    defaultColor = "warm neutrals";
  }

  const mood = d.mood || defaultMood;
  const layout = d.layoutStyle || defaultLayout;
  const typography = d.typography || defaultTypography;
  const color = d.colorDirection || defaultColor;
  const animation = d.animation || defaultAnimation;
  const visualRef = d.visualReference || "Linear / Apple aesthetic";
  const heroStyle = d.heroStyle || "static";

  const sections = d.sections.length ? d.sections.join(", ") : "Hero, Features, Social Proof, CTA, Closing";
  const ctaFocus = d.ctaFocus || "Book / Contact";

  const goal = `Create a high-converting digital presence concept (either a full-desktop landing page or a beautiful mobile web app concept enclosed in an elegant smartphone mockup device frame if appropriate for this business) for a ${lead.industry} business located in ${lead.location}, optimizing for the primary action: "${ctaFocus}".`;

  const heroStyleInstruction = heroStyle === "carousel"
    ? `HERO STYLE: carousel. You MUST build an Alpine.js-powered image carousel using 2-3 of the supplied AVAILABLE IMAGES, with clear previous/next chevron buttons, indicators, and automatic slide rotation (auto-rotate).`
    : `HERO STYLE: static. Use a single beautiful hero image layout from the supplied AVAILABLE IMAGES.`;

  const sectionRules = `
REQUIRED SECTIONS SPECIFICATIONS (build as a single-page HTML file with nav anchors):
- Sticky/fixed navigation bar with links pointing to #home, #about, #services, #contact (and #blog if appropriate for this industry), supporting smooth scroll behavior.
- Home / Hero (#home): Featuring the business name, hook (from SNAP Story/Need), primary CTA, and a background/hero image layout matching the requested HERO STYLE.
- About (#about): Story of credibility, based on SNAP copy Story.
- Services / Features (#services): Outcome-framed list of what the business does (reframe features around customer benefits).
- Blog / Insights (#blog): Optional (only if appropriate for this industry e.g. consultancy, creative agency. Do NOT include for a dentist or local medical clinic). Show 2-3 preview post cards.
- Contact (#contact): Details, custom form, phone/WhatsApp CTA (preferred channel: ${lead.preferredChannel || 'email'}).
`;

  const imagesBlock = images.length > 0
    ? `AVAILABLE IMAGES (use these exact URLs in <img> tags — do not invent URLs):
` + images.map((img, idx) => `${idx + 1}. ${img}`).join("\n") + `
- Only use image URLs provided in AVAILABLE IMAGES. Never invent an image URL — an invented URL will break in the browser. Always include attribution in the footer: "Photos via Pexels" if Pexels images are used (or "Photos via Unsplash" if fallback images are used).`
    : `AVAILABLE IMAGES: none (use CSS/gradients or placeholders instead of invented URLs).`;

  return `BUSINESS: ${lead.business}, ${lead.industry}, ${lead.location}
GOAL: ${goal}
MOOD: ${mood}
LAYOUT: ${layout}
TYPOGRAPHY: ${typography}
COLOR: ${color}
ANIMATION: ${animation}
VISUAL REFERENCE: ${visualRef}
HERO STYLE: ${heroStyle}

${lead.brandSource && lead.brandSource !== 'none' ? `BRAND CONTEXT (use these instead of generic assumptions):
Colors: ${(lead.brandColors || []).join(', ') || 'not available'}
Logo: ${lead.brandLogoUrl || 'none — use a clean text-based wordmark in the primary brand color'}
Fonts: ${(lead.brandFonts || []).join(', ') || 'not available — use direction typography'}
Tone: ${lead.brandToneSummary || 'not available'}
NOTE: When brand colors/fonts are present, they take precedence over the Mood/Typography/Color direction above.
` : ''}
${imagesBlock}

${sectionRules}

${heroStyleInstruction}

SECTIONS (in order):
${sections}

CTA FOCUS: ${ctaFocus}

COPY DIRECTION (SNAP):
Story: ${d.story || `As a visitor looking for quality ${lead.industry} in ${lead.location}, I feel understood.`}
Need: ${d.need || `Finding reliable, top-tier ${lead.industry} services can be challenging.`}
Answer: ${d.answer || `${lead.business} delivers exceptional quality tailored to your needs.`}
Proof: ${d.proof || `Trusted by clients across ${lead.location} with proven results.`}`;
}

export async function fetchStockImages(industry: string, mood: string): Promise<string[]> {
  const pexelsKey = import.meta.env.VITE_PEXELS_API_KEY || "";
  const query = `${mood} ${industry}`.trim();
  
  if (pexelsKey) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`;
      const res = await fetch(url, {
        headers: {
          Authorization: pexelsKey,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
          return data.photos.map((p: any) => p.src.large);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch images from Pexels:", err);
    }
  }

  // Fallback to high-quality static Unsplash URLs
  const ind = industry.toLowerCase();
  if (ind.includes("dent") || ind.includes("clinic") || ind.includes("health") || ind.includes("medic")) {
    return [
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=800&q=80"
    ];
  }
  if (ind.includes("rest") || ind.includes("cafe") || ind.includes("food") || ind.includes("bake") || ind.includes("coffee") || ind.includes("bakery")) {
    return [
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=800&q=80"
    ];
  }
  if (ind.includes("saas") || ind.includes("tech") || ind.includes("soft") || ind.includes("app") || ind.includes("agency") || ind.includes("consult")) {
    return [
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80"
    ];
  }
  if (ind.includes("well") || ind.includes("spa") || ind.includes("yoga") || ind.includes("care") || ind.includes("salon") || ind.includes("beauty")) {
    return [
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=800&q=80"
    ];
  }
  return [
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80"
  ];
}

const MOOD_THEMES: Record<string, { bg: string; fg: string; accent: string; muted: string; card: string }> = {
  minimal: { bg: "#ffffff", fg: "#111111", accent: "#111111", muted: "#666666", card: "#f5f5f5" },
  bold: { bg: "#0d0d0d", fg: "#ffffff", accent: "#ff4d2e", muted: "#a3a3a3", card: "#1a1a1a" },
  luxury: { bg: "#12100c", fg: "#f4efe6", accent: "#c8a24a", muted: "#a89e88", card: "#1c1912" },
  dark: { bg: "#0b0f14", fg: "#e8eef5", accent: "#4da3ff", muted: "#8b98a8", card: "#141b24" },
  futuristic: { bg: "#08090f", fg: "#eef0ff", accent: "#7c5cff", muted: "#8a8fb0", card: "#12131f" },
  corporate: { bg: "#f7f9fc", fg: "#0f1b2d", accent: "#1e5eff", muted: "#5b6b82", card: "#ffffff" },
  playful: { bg: "#fff8f0", fg: "#241a12", accent: "#ff8a3d", muted: "#8a6f57", card: "#ffffff" },
};

/**
 * Mock "AI" demo generator — produces a real, self-contained HTML document
 * themed from the direction so the iframe preview is meaningful.
 * (Backend/AI provider is wired separately.)
 */
export function generateDemoHtml(
  lead: Lead,
  d: PromptDirection,
  provider: Provider,
  refinements: string[] = [],
): string {
  const t = MOOD_THEMES[d.mood] ?? MOOD_THEMES.minimal;
  const contained = d.layoutStyle.includes("contained");
  const serif = d.typography.includes("serif");
  const mono = d.typography.includes("mono");
  const fontStack = serif
    ? "Georgia, 'Times New Roman', serif"
    : mono
      ? "'JetBrains Mono', ui-monospace, monospace"
      : "'Inter', system-ui, sans-serif";
  const maxW = contained ? "1080px" : "100%";
  const has = (s: string) => d.sections.includes(s);
  const headline = d.answer || `${lead.business}`;
  const sub = d.story || d.need || `The best ${lead.industry.toLowerCase()} in ${lead.location}.`;
  const cta = d.ctaFocus || "Get in touch";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${lead.business}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:${fontStack}; background:${t.bg}; color:${t.fg}; line-height:1.5; }
  .wrap { max-width:${maxW}; margin:0 auto; padding:0 24px; }
  header { display:flex; justify-content:space-between; align-items:center; padding:20px 0; }
  .logo { font-weight:800; letter-spacing:-.02em; font-size:18px; }
  nav a { color:${t.muted}; text-decoration:none; margin-left:22px; font-size:14px; }
  .btn { background:${t.accent}; color:${t.bg}; border:none; padding:12px 22px; border-radius:10px; font-weight:700; font-size:15px; cursor:pointer; text-decoration:none; display:inline-block; }
  .hero { padding:88px 0 72px; }
  .badge { display:inline-block; font-size:12px; text-transform:uppercase; letter-spacing:.14em; color:${t.accent}; margin-bottom:18px; }
  h1 { font-size:clamp(38px,6vw,68px); line-height:1.02; letter-spacing:-.03em; max-width:16ch; margin-bottom:20px; }
  .sub { font-size:20px; color:${t.muted}; max-width:52ch; margin-bottom:32px; }
  section { padding:64px 0; border-top:1px solid ${t.card}; }
  h2 { font-size:32px; letter-spacing:-.02em; margin-bottom:32px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
  .card { background:${t.card}; border-radius:16px; padding:26px; }
  .card h3 { font-size:18px; margin-bottom:8px; }
  .card p { color:${t.muted}; font-size:15px; }
  .quote { font-size:24px; max-width:36ch; letter-spacing:-.01em; }
  .quote span { color:${t.muted}; display:block; font-size:15px; margin-top:16px; }
  .ctaband { text-align:center; }
  .ctaband h2 { margin-bottom:20px; }
  footer { padding:40px 0; color:${t.muted}; font-size:14px; text-align:center; border-top:1px solid ${t.card}; }
  @media(max-width:720px){ .grid{grid-template-columns:1fr;} }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo">${lead.business}</div>
    <nav>
      <a href="#">Home</a><a href="#">Services</a><a href="#">Contact</a>
      <a class="btn" href="#" style="margin-left:22px;padding:9px 16px;font-size:13px;">${cta}</a>
    </nav>
  </header>

  ${has("Hero") || d.sections.length === 0 ? `<div class="hero">
    <span class="badge">${lead.industry} · ${lead.location}</span>
    <h1>${headline}</h1>
    <p class="sub">${sub}</p>
    <a class="btn" href="#">${cta}</a>
  </div>` : ""}

  ${has("Features") ? `<section>
    <h2>What we do</h2>
    <div class="grid">
      <div class="card"><h3>Crafted quality</h3><p>${d.need || "Everything done right, the first time."}</p></div>
      <div class="card"><h3>Local &amp; trusted</h3><p>Proudly serving ${lead.location}.</p></div>
      <div class="card"><h3>Fast &amp; friendly</h3><p>Book online in under a minute.</p></div>
    </div>
  </section>` : ""}

  ${has("Social Proof") ? `<section>
    <p class="quote">&ldquo;${d.proof || "Absolutely the best experience we've had — highly recommend."}&rdquo;
    <span>— Verified customer, ${lead.location}</span></p>
  </section>` : ""}

  ${has("CTA") ? `<section class="ctaband">
    <h2>${d.answer || `Ready to work with ${lead.business}?`}</h2>
    <a class="btn" href="#">${cta}</a>
  </section>` : ""}

  ${has("Closing") ? `<section class="ctaband">
    <p class="sub" style="margin:0 auto;">${d.story || "Join hundreds of happy customers."}</p>
  </section>` : ""}

  <footer>© ${new Date().getFullYear()} ${lead.business} — demo by Trendtactics Digital · generated with ${provider === "claude" ? "Claude" : "Gemini"}${refinements.length ? ` · ${refinements.length} refinement(s)` : ""}</footer>
</div>
</body>
</html>`;
}
