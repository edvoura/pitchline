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
  onStageChange?: (stage: "planning" | "building") => void,
): Promise<{ html: string; tokensUsed: number; generationMs: number }> {
  const apiKey = (typeof process !== "undefined" ? process.env.CLAUDE_API_KEY : undefined) || import.meta.env.VITE_CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Claude API key is not configured. Please set CLAUDE_API_KEY or VITE_CLAUDE_API_KEY.");
  }

  const start = Date.now();
  let tokensUsed = 0;

  const planSystemInstruction = `You are an expert web strategist and designer.
Given a prompt brief for a landing page, output a structured JSON plan for the website layout, content outline, aesthetics, and interactive elements.
Do not include any conversational text or markdown code blocks (like \`\`\`json). Output ONLY the raw JSON object.
Use this exact JSON shape:
{
  "sections": [{"name": "Hero | Features | Social Proof | CTA | Closing", "purpose": "Description of section goals and content"}],
  "copyOutline": {"story": "SNAP Story hook", "need": "SNAP Need focus", "answer": "SNAP Answer details", "proof": "SNAP Proof proofpoints"},
  "colorPalette": ["Tailwind color codes e.g. bg-slate-900, text-emerald-400"],
  "typography": "font-sans | font-serif | font-mono",
  "interactiveElements": ["accordions", "tabs", "mobile-nav", "modals", "reveals"]
}`;

  const buildSystemInstruction = `You are an expert web designer/developer building a single-page website demo.
Follow these rules regardless of how much detail is given below:
- EVERY section must have one clear purpose per the design framework.
- Write copy using Story -> Need -> Answer -> Proof (SNAP framework). Never write like a marketer — write like someone who deeply understands this exact audience.
- Style the page beautifully using Tailwind CSS. Use the Tailwind CDN:
  <script src="https://cdn.tailwindcss.com"></script>
- Use Alpine.js for ALL interactive components (tabs, accordions, mobile nav toggle, modals, reveals, etc.). Load Alpine via CDN:
  <script src="https://unpkg.com/alpinejs" defer></script>
- Do not produce static markup with no interactive elements. A premium demo must have working micro-interactions, hover states on cards/buttons, smooth scroll reveals, and toggle states.
- BASELINE QUALITY BAR:
  1. Spacing rhythm, visual hierarchy, and contrast must be premium and obvious at a glance.
  2. If the brief indicates a mobile app or software concept, build a gorgeous interactive smartphone UI viewport container (using clean CSS device frame mockups) right in the center of the viewport, rather than just a standard desktop layout.
- Output ONLY valid, raw, production-ready, self-contained HTML + CSS for the requested website. Do not include markdown code block backticks (like \`\`\`html) or conversational text before or after the code. Start directly with <!DOCTYPE html>.`;

  let planText = "";
  if (!currentHtml) {
    if (onStageChange) onStageChange("planning");
    // Stage 1: Planning
    const planResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        system: planSystemInstruction,
        messages: [{ role: "user", content: `Prompt: ${prompt}` }],
      }),
    });
    if (planResponse.ok) {
      const planPayload = await planResponse.json();
      planText = planPayload.content?.[0]?.text || "";
      tokensUsed += (planPayload.usage?.input_tokens || 0) + (planPayload.usage?.output_tokens || 0);
    }
  }

  // Stage 2: Building
  if (onStageChange) onStageChange("building");

  let promptText = prompt;
  if (currentHtml) {
    promptText = `Here is the current HTML code of the website:\n\n${currentHtml}\n\nApply the following refinements to the design. Do not explain anything; output the revised self-contained HTML code directly:\n\n${refinements
      ?.map((r, i) => `${i + 1}. ${r}`)
      .join("\n")}`;
  } else {
    promptText = `Prompt Brief: ${prompt}\n\nDesign Plan (follow this layout and structure):\n${planText}`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "anthropic-beta": "max-tokens-2024-08-28", // Enable 8k output tokens
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8000,
      system: buildSystemInstruction,
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
  tokensUsed += (payload.usage?.input_tokens || 0) + (payload.usage?.output_tokens || 0);
  const generationMs = Date.now() - start;

  return { html, tokensUsed, generationMs };
}
