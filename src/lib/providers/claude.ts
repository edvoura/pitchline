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
  screenshotBase64?: string | null,
  onStageChange?: (stage: "planning" | "building") => void,
): Promise<{ html: string; tokensUsed: number; generationMs: number }> {
  const apiKey = (typeof process !== "undefined" ? process.env.CLAUDE_API_KEY : undefined) || import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Claude API key is not configured. Please set CLAUDE_API_KEY or VITE_CLAUDE_API_KEY.");
  }

  const start = Date.now();

  const isRefinement = !!(currentHtml && refinements && refinements.length > 0);

  // Single-call system instruction with planning guidance built in
  const baseSystemInstruction = `You are an expert web designer/developer building a single-page website demo.

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
- To prevent sandboxed iframe navigation bugs, you MUST include this exact script in the head to intercept all anchor links and handle scrolling locally:
  \`<script>
    document.addEventListener("click", function(e) {
      const a = e.target.closest("a");
      if (a) {
        const href = a.getAttribute("href");
        if (href && href.startsWith("#")) {
          e.preventDefault();
          const targetId = href.substring(1);
          const targetEl = document.getElementById(targetId || "home");
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: "smooth" });
          }
        }
      }
    });
  </script>\`

BUILDING RULES (follow these strictly):
- If a BRAND CONTEXT block is present in the prompt, use the exact brand colors as your primary palette (e.g. for backgrounds, accents, buttons), the brand fonts as typography, and the brand logo URL as the header icon/image. These override any generic Mood/Typography/Color direction.
- Style the page using Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Use Alpine.js via CDN for interactive components (mobile menu toggle, accordion expand/collapse, modal open/close, image carousels/sliders, and scroll-triggered entry/motion animations): <script src="https://unpkg.com/alpinejs" defer></script>
- MULTIPLE WEB PAGE EXPERIENCE: The website must be designed as a multiple-page concept using an Alpine.js state router (e.g., x-data="{ page: 'home' }"). The navigation links must toggle the active page view (Home, About Us, Services, Contact Us, and Blog) using click handlers (e.g., @click.prevent="page = 'about'"), and apply active styling to the active link. Use Tailwind transitions to animate the page transitions. The footer must remain visible across all pages.
- BACKGROUND CONSISTENCY: If the hero uses a dark background (e.g. bg-slate-900, bg-gray-900, bg-indigo-950), then ALL sections must use that same dark scheme or closely related dark shades. NEVER suddenly switch to bg-white or a plain white background for any section.
- Every section must have a unique id attribute matching its nav anchor (e.g. id="home", id="services", id="testimonials", id="contact").
- Write copy like someone who deeply understands the target audience — never generic marketing speak.
- BASELINE QUALITY BAR:
  1. Spacing rhythm, visual hierarchy, and contrast must be premium and obvious at a glance.
  2. Never produce a flat static page with no motion — add hover transitions on buttons/cards, smooth scroll behavior, and scroll-triggered entry animations (using Tailwind transitions or simple custom styles).
  3. Include tasteful micro-interactions (e.g. interactive accordion, animated stats counter, interactive dropdowns) using Alpine.js and Tailwind transitions.
  4. HERO & MULTIPLE PARALLAX SECTIONS:
     - The hero section (#home) MUST feature a large, high-quality, professional background image using one of the provided AVAILABLE IMAGES.
     - Intelligently include background images with a PARALLAX scrolling effect on multiple key sections of the website (such as the Hero section, divider banners, and contact headers) using 'background-attachment: fixed; background-size: cover; background-position: center; background-repeat: no-repeat;'. Add a media query to fallback to 'background-attachment: scroll;' on mobile/tablet screens (max-width: 1024px) to keep it responsive and performant.
     - The hero text, headers, and buttons MUST be placed inside an overlaid text box with glassmorphism or a semi-transparent dark backdrop overlay (e.g., Tailwind \`bg-black/50 backdrop-blur-md\` or \`bg-slate-900/60 p-8 rounded-2xl\`) so that all text has excellent, accessible contrast against the background image.
     - NEVER use a plain colored background (like solid bg-slate-900) for the hero if AVAILABLE IMAGES are present.
- FOOTER (#footer) is 100% REQUIRED on every single generation:
  - It must NOT be skipped, truncated, or left minimal.
  - Build it as a rich 3- or 4-column footer containing:
    • Column 1: Business name, short descriptive tagline, and a subtle "Built by Trendtactics Digital" signature.
    • Column 2: Navigation Links (Home, About, Services, Contact, etc.).
    • Column 3: Contact Details (Phone, Email, Address, WhatsApp link).
    • Column 4: Legals & Attributions (Copyright line: "© {current_year} {business_name}. All rights reserved.", photo attribution like "Photos via Pexels" or "Photos via Unsplash").
  - Give the footer a rich dark background with high contrast text and appropriate padding.
- MOBILE-FIRST RESPONSIVENESS (critical):
  • Build the base layout for small screens first, then use Tailwind responsive prefixes (sm:, md:, lg:) to scale up.
  • Nav MUST collapse to a hamburger menu below md breakpoint (use Alpine.js x-show for the mobile menu toggle — this is the ONLY acceptable use of x-show).
  • Images and carousels must never overflow the viewport on mobile.
  • Font sizes must remain legible at mobile width (min 14px effective).
  • Touch targets (buttons, nav links) must be large enough to tap comfortably (min 44px touch target).
- Output ONLY valid, raw, production-ready, self-contained HTML. Do not include markdown code block backticks (like \`\`\`html) or conversational text. Start directly with <!DOCTYPE html>.`;

  // Append revision-specific system instruction for refinements
  const systemInstruction = isRefinement
    ? baseSystemInstruction + `\n\nIMPORTANT — REVISION MODE:\n` +
      `This is a revision request. You are given the current HTML and a list of REQUIRED CHANGES.\n` +
      `1. YOU MUST PRESERVE the entire structure of the existing site, including all simulated pages/views (Home, About, Services, Contact, Blog), all existing sections, the header navigation, and ESPECIALLY the Footer (#footer).\n` +
      `2. NEVER delete, truncate, or omit any section or the footer unless explicitly asked to do so in the changes list.\n` +
      `3. Visibly implement every single REQUIRED CHANGE listed below. Do NOT return a near-identical copy of the previous version if significant changes were requested.\n` +
      `4. Keep the output fully self-contained, valid HTML. Start directly with <!DOCTYPE html>.`
    : baseSystemInstruction;

  if (onStageChange) onStageChange("building");

  let promptText = prompt;
  if (isRefinement) {
    // Structured refinement prompt: keep original brief for context, include current HTML,
    // and make the required changes structurally prominent — not buried after a huge HTML blob.
    const refinementList = refinements!.map((r, i) => `${i + 1}. ${r}`).join("\n");
    promptText = `ORIGINAL BRIEF (for context — this describes the business and design direction):
${prompt}

---

CURRENT HTML (the version to revise):
${currentHtml}

---

⚠️ REQUIRED CHANGES FOR THIS REVISION (you MUST implement ALL of these — do not skip any):
${refinementList}

Output the complete revised self-contained HTML with these changes clearly applied. Do not explain anything.`;
  }

  let imageContentBlock = null;
  if (screenshotBase64) {
    const match = screenshotBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (match) {
      const mediaType = match[1];
      const base64Data = match[2];
      imageContentBlock = {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      };
    }
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
      temperature: isRefinement ? 0.5 : 0.85,
      system: systemInstruction,
      messages: [{
        role: "user",
        content: imageContentBlock
          ? [
              {
                type: "text",
                text: promptText + `\n\nREFERENCE TEMPLATE SCREENSHOT: Please use the attached screenshot as a visual reference / template for the styling, components, or layout of this website concept. Match its premium design aesthetic, visual hierarchy, alignment, card layouts, colors, or structural patterns where appropriate.`,
              },
              imageContentBlock
            ]
          : [{ type: "text", text: promptText }],
      }],
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

  // Safeguard: detect near-identical output after refinement (failed refinement)
  if (isRefinement && currentHtml) {
    const prevLen = currentHtml.length;
    const newLen = html.length;
    const lenDiff = Math.abs(newLen - prevLen);
    const lenRatio = lenDiff / Math.max(prevLen, 1);
    if (lenRatio < 0.02 && prevLen > 500) {
      console.warn(`[Claude] Refinement produced near-identical output (length diff: ${lenDiff} chars, ${(lenRatio * 100).toFixed(1)}%). The model may have ignored the refinement instructions.`);
    }
  }

  return { html, tokensUsed, generationMs };
}
