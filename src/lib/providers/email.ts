/**
 * 1-Click Cold Outreach Email Integration (Resend API — Free 3,000 emails/month)
 */

interface SendEmailInput {
  toEmail: string;
  businessName: string;
  leadId: string;
  demoUrl?: string;
  customBody?: string;
}

export async function sendOutreachEmail(input: SendEmailInput): Promise<{ success: boolean; messageId?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on the server. Please add your free Resend key to environment variables.");
  }

  const subject = `Website Concept & Digital Transformation for ${input.businessName}`;
  
  const defaultBody = `Hi ${input.businessName} Team,

I put together a custom, interactive website demo specifically tailored for ${input.businessName}.

You can preview the interactive concept here:
${input.demoUrl || "#"}

We built this concept to help elevate your digital presence, improve customer trust, and drive more direct inquiries.

Would you be open to a 5-minute chat this week to review the concept?

Best regards,
Trendtactics Digital Team`;

  const bodyContent = input.customBody || defaultBody;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Pitchline Outbound <onboarding@resend.dev>",
      to: [input.toEmail],
      subject: subject,
      text: bodyContent,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend Email Error: ${response.status} - ${errText}`);
  }

  const payload = await response.json();
  return { success: true, messageId: payload.id };
}
