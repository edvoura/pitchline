import type { Lead, PromptDirection, Provider } from "./types";

/**
 * Assemble the structured "master template" prompt from a lead + direction.
 * Returns a deterministic, copy-pasteable block.
 */
export function compilePrompt(lead: Lead, d: PromptDirection): string {
  const sections = d.sections.length ? d.sections.join(", ") : "Hero, CTA";
  return `# WEBSITE DEMO BRIEF — ${lead.business}

## TARGET
Business: ${lead.business}
Industry: ${lead.industry}
Location: ${lead.location}

## DIRECTION
Mood: ${d.mood || "—"}
Layout: ${d.layoutStyle || "—"}
Typography: ${d.typography || "—"}
Color: ${d.colorDirection || "—"}
Animation: ${d.animation}
Visual reference: ${d.visualReference || "—"}

## SECTIONS
${sections}

## PRIMARY CTA
${d.ctaFocus || "Book / Contact"}

## SNAP COPY
Story hook: ${d.story || "—"}
Need: ${d.need || "—"}
Answer: ${d.answer || "—"}
Proof point: ${d.proof || "—"}

## INSTRUCTIONS
Build a single-page, responsive marketing website for the business above.
Honor the direction exactly. Use the SNAP copy to write the hero and body
copy. Make the primary CTA the most prominent action on the page. Output
production-ready, self-contained HTML + CSS.`;
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
