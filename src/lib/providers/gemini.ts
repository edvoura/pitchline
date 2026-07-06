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
1. Decide on 5 sections: Hero, Features/Services, Social Proof, CTA, Footer
2. Plan the copy outline using Story -> Need -> Answer -> Proof (SNAP framework)
3. Choose a harmonious color palette using Tailwind utility classes
4. Decide which interactive elements to include (at least 3 of: accordion, tabs, mobile-nav toggle, modal, scroll-reveal, counter animation)

BUILDING RULES (follow these strictly):
- Style the page using Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Use Alpine.js via CDN for ALL interactive components: <script src="https://unpkg.com/alpinejs" defer></script>
- Every demo MUST have working interactive elements — tabs that switch content, mobile menu that toggles, accordions that expand/collapse, smooth scroll, hover states on all buttons and cards.
- Write copy like someone who deeply understands the target audience — never generic marketing speak.
- BASELINE QUALITY BAR:
  1. Spacing rhythm, visual hierarchy, and contrast must be premium and obvious at a glance.
  2. Never produce a flat static page with no motion — add hover transitions, scroll animations, and state changes.
  3. If the brief indicates a mobile app or software concept, build a gorgeous interactive smartphone UI viewport mockup in the center of the page.
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
