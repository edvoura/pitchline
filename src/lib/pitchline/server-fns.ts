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
  .validator((data: any) => data)
  .handler(async (ctx): Promise<GenerateDemoResult> => {
    const input = ctx && ctx.data ? ctx.data : ctx;
    const { compiledPrompt, provider, refinements = [], currentHtml } = input || {};

    if (!compiledPrompt || !provider) {
      throw new Error("Invalid or missing 'compiledPrompt' or 'provider' fields.");
    }

    if (provider === "claude") {
      return generateClaudeDemo(compiledPrompt, currentHtml, refinements);
    } else {
      return generateGeminiDemo(compiledPrompt, currentHtml, refinements);
    }
  });

interface SendOutreachInput {
  toEmail: string;
  businessName: string;
  leadId: string;
  demoUrl?: string;
  customBody?: string;
}

export const sendOutreachEmailFn = createServerFn({ method: "POST" })
  .validator((data: any) => data)
  .handler(async (ctx) => {
    const input = ctx && ctx.data ? ctx.data : ctx;
    const { sendOutreachEmail } = await import("../providers/email");
    return sendOutreachEmail(input);
  });
