import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

let supabaseUrl = "";
let supabaseKey = "";

try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
  const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseKey = keyMatch[1].trim();
} catch (e) {
  console.log("Could not read .env.local:", e.message);
}

async function run() {
  console.log("Connecting to Supabase:", supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: demos, error } = await supabase.from("demos").select("*").order("created_at", { ascending: false }).limit(3);
  if (error) {
    console.error("Error fetching demos:", error.message);
    return;
  }

  console.log(`Found ${demos.length} demos:`);
  demos.forEach((d, idx) => {
    console.log(`--- Demo ${idx + 1} ---`);
    console.log("Lead ID:", d.lead_id);
    console.log("Created At:", d.created_at);
    console.log("Provider:", d.provider);
    console.log("HTML length:", d.html ? d.html.length : 0);
    console.log("HTML Sample:", d.html ? d.html.substring(0, 300) + "..." : "null");
  });
}
run();
