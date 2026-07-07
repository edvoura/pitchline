import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug } = req.query;

  if (!slug || typeof slug !== "string") {
    return res.status(400).send("Missing slug");
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from("demos")
      .select("html")
      .eq("public_slug", slug)
      .maybeSingle();

    if (error || !data || !data.html) {
      return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Demo Not Found</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0b0f14;
      color: #e8eef5;
    }
    .c { text-align: center; padding: 20px; }
    .c h1 { font-size: 3rem; margin: 0 0 1rem; color: #ff4d2e; }
    .c p { color: #8b98a8; font-size: 1.1rem; margin: 0; }
  </style>
</head>
<body>
  <div class="c">
    <h1>404</h1>
    <p>This demo concept link has expired or doesn't exist.</p>
  </div>
</body>
</html>`);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
    return res.status(200).send(data.html);
  } catch (err) {
    console.error("Error fetching demo by slug:", err);
    return res.status(500).send("Internal Server Error");
  }
}
