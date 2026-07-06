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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const start = Date.now();

  const systemInstruction =
    "You are an expert web designer/developer. Output ONLY valid, raw, production-ready, self-contained HTML + CSS for the requested website. Do not include markdown code block backticks (like ```html) or conversational text before or after the code. Start directly with <!DOCTYPE html>.";

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
