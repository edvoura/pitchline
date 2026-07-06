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
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get table info or select 1 row to see properties
  console.log("Querying leads table...");
  const { data: leads, error: leadsErr } = await supabase.from("leads").select("*").limit(1);
  if (leadsErr) console.error("Leads error:", leadsErr.message);
  else console.log("Leads columns:", Object.keys(leads[0] || {}));

  console.log("Querying templates table...");
  const { data: temps, error: tempsErr } = await supabase.from("templates").select("*").limit(1);
  if (tempsErr) console.error("Templates error:", tempsErr.message);
  else console.log("Templates columns:", Object.keys(temps[0] || {}));

  console.log("Querying prompts table...");
  const { data: prompts, error: promptsErr } = await supabase.from("prompts").select("*").limit(1);
  if (promptsErr) console.error("Prompts error:", promptsErr.message);
  else console.log("Prompts columns:", Object.keys(prompts[0] || {}));

  console.log("Querying demos table...");
  const { data: demos, error: demosErr } = await supabase.from("demos").select("*").limit(1);
  if (demosErr) console.error("Demos error:", demosErr.message);
  else console.log("Demos columns:", Object.keys(demos[0] || {}));
}
run();
