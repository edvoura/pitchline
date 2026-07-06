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

export async function generateGeminiDemo(
  prompt: string,
  currentHtml?: string | null,
  refinements?: string[],
): Promise<{ html: string; tokensUsed: number; generationMs: number }> {
  const apiKey = (typeof process !== "undefined" ? process.env.GEMINI_API_KEY : undefined) || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please set GEMINI_API_KEY or VITE_GEMINI_API_KEY.");
  }

  const start = Date.now();

  const systemInstruction = `You are an expert web designer/developer building a single-page website demo. Follow these rules regardless of how much detail is given below:
- Every section must have one clear purpose (Hero: immediate clarity + hook. Features: outcome-framed, not a feature list. Social proof: trust transfer. CTA: one unambiguous action. Closing: reinforce feeling.)
- Write copy using Story -> Need -> Answer -> Proof (SNAP framework). Never write like a marketer — write like someone who deeply understands this exact audience.
- Respect the stated mood precisely — do not default to generic "modern clean" design if a specific mood (luxury, futuristic, dark, playful, etc.) is given.
- BASELINE QUALITY BAR (apply even if not explicitly requested):
  1. Include tasteful micro-interactions: hover states on buttons/cards, smooth scroll-triggered fade-ins on section entry, subtle transitions — never a static, flat page with zero motion.
  2. Visual hierarchy must be obvious at a glance: clear spacing rhythm, intentional contrast, no cramped or uniform-looking blocks of text.
  3. Never default to a generic template look (centered text + stock gradient + Bootstrap-like buttons). Choose a specific point of view.
  4. Every demo should look like it took a designer a day, not like a form was auto-filled into a template.
  5. If the brief indicates a mobile app or software concept, build a gorgeous interactive smartphone UI viewport container (using clean CSS device frame mockups) right in the center of the viewport, rather than just a standard desktop layout.
- Output ONLY valid, raw, production-ready, self-contained HTML + CSS for the requested website. Do not include markdown code block backticks (like \`\`\`html) or conversational text before or after the code. Start directly with <!DOCTYPE html>.`;

  let promptText = prompt;
  if (currentHtml) {
    promptText = `Here is the current HTML code of the website:\n\n${currentHtml}\n\nApply the following refinements to the design. Do not explain anything; output the revised self-contained HTML code directly:\n\n${refinements
      ?.map((r, i) => `${i + 1}. ${r}`)
      .join("\n")}`;
  } else if (refinements && refinements.length > 0) {
    promptText += `\n\n## USER REFINEMENTS (Apply these updates):\n${refinements
      .map((r, i) => `${i + 1}. ${r}`)
      .join("\n")}`;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
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
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const payload = await response.json();
  const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const html = cleanHtml(rawText);
  const tokensUsed = payload.usageMetadata?.totalTokenCount || 0;
  const generationMs = Date.now() - start;

  return { html, tokensUsed, generationMs };
}
