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

/** Retry-aware fetch: retries on 429 / 503 / 500 with exponential backoff */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 2,
): Promise<Response> {
  const delays = [3000, 6000, 12000]; // 3s, 6s, 12s
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init);

    if (response.ok) return response;

    // Only retry on rate-limit or transient server errors
    if ([429, 500, 503].includes(response.status) && attempt < maxRetries) {
      console.warn(
        `[Gemini] Attempt ${attempt + 1} failed with ${response.status}, retrying in ${delays[attempt]}ms...`,
      );
      await new Promise((r) => setTimeout(r, delays[attempt]));
      lastResponse = response;
      continue;
    }

    return response; // Non-retryable error, return as-is
  }

  return lastResponse!;
}

// Model priority: try gemini-2.0-flash first (higher rate limits),
// fall back to gemini-2.5-flash if the primary model errors
const MODELS = ["gemini-2.0-flash", "gemini-2.5-flash"] as const;

export async function generateGeminiDemo(
  prompt: string,
  currentHtml?: string | null,
  refinements?: string[],
  onStageChange?: (stage: "planning" | "building") => void,
): Promise<{ html: string; tokensUsed: number; generationMs: number }> {
  const apiKey = (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined) || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY.");
  }

  const start = Date.now();

  // Single-call system instruction that includes planning guidance inline
  // (avoids double API calls which exhaust rate limits)
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
- Use Alpine.js via CDN for interactive components (mobile menu toggle, accordion expand/collapse, modal open/close, image carousels/sliders, and scroll-triggered entry/motion animations): <script src="https://unpkg.com/alpinejs" defer></script>
- DO NOT use Alpine.js to control page section visibility. Sections must always be rendered and visible.
- BACKGROUND CONSISTENCY: If the hero uses a dark background (e.g. bg-slate-900, bg-gray-900, bg-indigo-950), then ALL sections must use that same dark scheme or closely related dark shades. NEVER suddenly switch to bg-white or a plain white background for any section.
- Every section must have a unique id attribute matching its nav anchor (e.g. id="home", id="services", id="testimonials", id="contact").
- Write copy like someone who deeply understands the target audience — never generic marketing speak.
- BASELINE QUALITY BAR:
  1. Spacing rhythm, visual hierarchy, and contrast must be premium and obvious at a glance.
  2. Never produce a flat static page with no motion — add hover transitions on buttons/cards, smooth scroll behavior, and scroll-triggered entry animations (using Tailwind transitions or simple custom styles).
  3. Include tasteful micro-interactions (e.g. interactive accordion, animated stats counter, interactive dropdowns) using Alpine.js and Tailwind transitions.
- FOOTER (#footer) is REQUIRED on every demo. Include:
  • Business name + short tagline
  • Repeated quick links to the anchors used (Home, About, Services, Contact)
  • Contact recap (phone/WhatsApp/email as applicable)
  • Copyright line: "© {current_year} {business_name}. All rights reserved."
  • Photo attribution if stock images were used: "Photos via Pexels" or "Photos via Unsplash"
- MOBILE-FIRST RESPONSIVENESS (critical):
  • Build the base layout for small screens first, then use Tailwind responsive prefixes (sm:, md:, lg:) to scale up.
  • Nav MUST collapse to a hamburger menu below md breakpoint (use Alpine.js x-show for the mobile menu toggle — this is the ONLY acceptable use of x-show).
  • Images and carousels must never overflow the viewport on mobile.
  • Font sizes must remain legible at mobile width (min 14px effective).
  • Touch targets (buttons, nav links) must be large enough to tap comfortably (min 44px touch target).
- Output ONLY valid, raw, production-ready, self-contained HTML. Do not include markdown code block backticks (like \`\`\`html) or conversational text. Start directly with <!DOCTYPE html>.`;

  if (onStageChange) onStageChange("building");

  let promptText = prompt;
  if (currentHtml) {
    promptText = `Here is the current HTML code of the website:\n\n${currentHtml}\n\nApply the following refinements to the design. Do not explain anything; output the revised self-contained HTML code directly:\n\n${refinements
      ?.map((r, i) => `${i + 1}. ${r}`)
      .join("\n")}`;
  }

  // Try each model in priority order
  let lastError = "";
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log(`[Gemini] Trying model: ${model}...`);

    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemInstruction}\n\n${promptText}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.3,
        },
      }),
    });

    if (!response.ok) {
      lastError = await response.text();
      console.warn(`[Gemini] Model ${model} failed: ${response.status} - ${lastError.substring(0, 200)}`);
      // Try next model
      continue;
    }

    const payload = await response.json();
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!rawText || rawText.length < 50) {
      console.warn(`[Gemini] Model ${model} returned empty/short response, trying next model...`);
      lastError = "Empty response from model";
      continue;
    }

    const html = cleanHtml(rawText);
    const tokensUsed = payload.usageMetadata?.totalTokenCount || 0;
    const generationMs = Date.now() - start;

    return { html, tokensUsed, generationMs };
  }

  throw new Error(`Gemini API Error: All models failed. Last error: ${lastError.substring(0, 300)}`);
}
