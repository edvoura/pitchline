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

export async function generateClaudeDemo(
  prompt: string,
  currentHtml?: string | null,
  refinements?: string[],
): Promise<{ html: string; tokensUsed: number; generationMs: number }> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("CLAUDE_API_KEY is not configured on the server.");
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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
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
