function cleanHtml(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    const nextNewline = text.indexOf("\n");
    if (nextNewline !== -1) {
      text = text.substring(nextNewline + 1);
    } else {
      text = text.substring(3);
    }
  }
  if (text.endsWith("```")) {
    text = text.substring(0, text.length - 3);
  }
  return text.trim();
}

/** Retry-aware fetch: retries on 429 / 503 / 500 / 529 with exponential backoff */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  const delays = [3000, 6000, 12000];
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);

    if (response.ok) return response;

    if ([429, 500, 503, 529].includes(response.status) && attempt < maxRetries) {
      console.warn(
        `[Claude] Attempt ${attempt + 1} failed with ${response.status}, retrying in ${delays[attempt]}ms...`,
      );
      await new Promise((r) => setTimeout(r, delays[attempt]));
      lastResponse = response;
      continue;
    }

    return response;
  }

  return lastResponse!;
}

export async function generateClaudeDemo(
  prompt: string,
  currentHtml?: string | null,
  refinements?: string[],
  onStageChange?: (stage: "planning" | "building") => void,
): Promise<{ html: string; tokensUsed: number; generationMs: number }> {
  const apiKey = (typeof process !== "undefined" ? process.env.CLAUDE_API_KEY : undefined) || import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Claude API key is not configured. Please set CLAUDE_API_KEY or VITE_CLAUDE_API_KEY.");
  }

  const start = Date.now();

  // Single-call system instruction with planning guidance built in
  const systemInstruction = `You are an expert web designer/developer building a single-page website demo.

PLANNING PHASE (do this mentally before writing code):
1. Decide on sections: Home/Hero, About, Services/Features, Testimonials/Social Proof, Contact/CTA, Footer
2. Plan the copy outline using Story -> Need -> Answer -> Proof (SNAP framework)
3. Choose a harmonious, consistent color palette — pick ONE dark or rich background color scheme and use it EVERYWHERE (never switch to plain white backgrounds mid-page)
4. Decide which interactive elements to include (at least 3 of: accordion, mobile-nav toggle, scroll-reveal animations, counter animation, hover card effects)

CRITICAL LAYOUT RULES:
- Build a SINGLE-PAGE SCROLLING WEBSITE where ALL sections are visible on the page at all times — the user scrolls down through them.
- NEVER use Alpine.js x-show or x-if to hide/show entire page sections like tabs. Every section must always be in the DOM and visible.
- Navigation links must be ANCHOR LINKS (href="#home", href="#services", etc.) that smooth-scroll to the corresponding section ID.
- The first navigation item MUST be "Home" linking to the hero/top section (id="home").
- Add smooth scrolling behavior: include \`<style>html { scroll-behavior: smooth; }</style>\` in the head.

BUILDING RULES (follow these strictly):
- If a BRAND CONTEXT block is present in the prompt, use the exact brand colors as your primary palette (e.g. for backgrounds, accents, buttons), the brand fonts as typography, and the brand logo URL as the header icon/image. These override any generic Mood/Typography/Color direction.
- Style the page using Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Use Alpine.js via CDN ONLY for small interactive components (mobile menu toggle, accordion expand/collapse, modal open/close): <script src="https://unpkg.com/alpinejs" defer></script>
- DO NOT use Alpine.js to control page section visibility. Sections must always be rendered and visible.
- BACKGROUND CONSISTENCY: If the hero uses a dark background (e.g. bg-slate-900, bg-gray-900, bg-indigo-950), then ALL sections must use that same dark scheme or closely related dark shades. NEVER suddenly switch to bg-white or a plain white background for any section.
- Every section must have a unique id attribute matching its nav anchor (e.g. id="home", id="services", id="testimonials", id="contact").
- Write copy like someone who deeply understands the target audience — never generic marketing speak.
- BASELINE QUALITY BAR:
  1. Spacing rhythm, visual hierarchy, and contrast must be premium and obvious at a glance.
  2. Never produce a flat static page with no motion — add hover transitions on buttons/cards, subtle section entry animations using CSS.
  3. If the brief indicates a mobile app or software concept, build a gorgeous interactive smartphone UI viewport mockup in the center of the page.
- Output ONLY valid, raw, production-ready, self-contained HTML. Do not include markdown code block backticks (like \`\`\`html) or conversational text. Start directly with <!DOCTYPE html>.`;

  if (onStageChange) onStageChange("building");

  let promptText = prompt;
  if (currentHtml) {
    promptText = `Here is the current HTML code of the website:\n\n${currentHtml}\n\nApply the following refinements to the design. Do not explain anything; output the revised self-contained HTML code directly:\n\n${refinements
      ?.map((r, i) => `${i + 1}. ${r}`)
      .join("\n")}`;
  }

  const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system: systemInstruction,
      messages: [{ role: "user", content: promptText }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API Error: ${response.status} - ${errorText}`);
  }

  const payload = await response.json();
  const rawHtml = payload.content?.[0]?.text || "";
  const html = cleanHtml(rawHtml);
  const tokensUsed =
    (payload.usage?.input_tokens || 0) + (payload.usage?.output_tokens || 0);
  const generationMs = Date.now() - start;

  return { html, tokensUsed, generationMs };
}
