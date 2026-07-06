import { createServerFn } from "@tanstack/react-start";
import { generateClaudeDemo } from "../providers/claude";
import { generateGeminiDemo } from "../providers/gemini";

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

export const generateDemoFn = createServerFn({ method: "POST" })
  .validator((data: GenerateDemoInput) => data)
  .handler(async ({ data }): Promise<GenerateDemoResult> => {
    const { compiledPrompt, provider, refinements, currentHtml } = data;

    if (provider === "claude") {
      return generateClaudeDemo(compiledPrompt, currentHtml, refinements);
    } else {
      return generateGeminiDemo(compiledPrompt, currentHtml, refinements);
    }
  });
