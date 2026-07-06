import fs from "fs";
import path from "path";

let apiKey = "";
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
  const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.+)/);
  if (match) apiKey = match[1].trim();
} catch (e) {
  console.log("Could not read .env.local:", e.message);
}

const systemInstruction = `You are an expert web designer/developer building a single-page website demo. Follow these rules:
- Output ONLY valid, raw, production-ready, self-contained HTML + CSS. Start directly with <!DOCTYPE html>.`;

const promptText = "Create a landing page for a Dentist in Lagos, Nigeria called 'Lagos Dental'. Include a hero section, services list, testimonials, and a booking form. Make it look beautiful and modern.";

async function testGeminiTime() {
  const start = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemInstruction}\n\n${promptText}` }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.2 }
      })
    });
    const duration = (Date.now() - start) / 1000;
    console.log(`Status:`, res.status);
    console.log(`Request took: ${duration.toFixed(2)} seconds`);
    const data = await res.json();
    if (res.ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      console.log("Output HTML length:", text.length);
    } else {
      console.log("Error:", data.error?.message);
    }
  } catch (err) {
    console.log("Exception:", err.message);
  }
}

testGeminiTime();
