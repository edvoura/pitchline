import { createServerFn } from "@tanstack/react-start";

interface GenerateDemoInput {
  compiledPrompt: string;
  provider: "claude" | "gemini";
  refinements: string[];
  currentHtml?: string | null;
}

interface GenerateDemoResult {
  html: string;
  tokensUsed: number;
  generationMs: number;
}

function cleanHtml(raw: string): string {
  let text = raw.trim();
  // Match any ```html ... ``` or ```xml ... ``` or ``` ... ```
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

export const generateDemoFn = createServerFn({ method: "POST" })
  .validator((data: GenerateDemoInput) => data)
  .handler(async ({ data }): Promise<GenerateDemoResult> => {
    const { compiledPrompt, provider, refinements, currentHtml } = data;
    const start = Date.now();

    let systemInstruction =
      "You are an expert web designer/developer. Output ONLY valid, raw, production-ready, self-contained HTML + CSS for the requested website. Do not include markdown code block backticks (like ```html) or conversational text before or after the code. Start directly with <!DOCTYPE html>.";

    let promptText = compiledPrompt;
    if (currentHtml) {
      promptText = `Here is the current HTML code of the website:\n\n${currentHtml}\n\nApply the following refinements to the design. Do not explain anything; output the revised self-contained HTML code directly:\n\n${refinements
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n")}`;
    } else if (refinements.length > 0) {
      promptText += `\n\n## USER REFINEMENTS (Apply these updates):\n${refinements
        .map((r, i) => `${i + 1}. ${r}`)
        .join("\n")}`;
    }

    if (provider === "claude") {
      const apiKey = process.env.CLAUDE_API_KEY;
      if (!apiKey) {
        throw new Error("CLAUDE_API_KEY is not configured on the server.");
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
    } else {
      // Gemini API
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
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
  });
