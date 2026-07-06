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

console.log("Using URL:", supabaseUrl);
console.log("Using Key (first 10 chars):", supabaseKey.substring(0, 10));

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Fetching leads...");
  const { data: leads, error } = await supabase.from("leads").select("*");
  if (error) {
    console.error("Fetch leads error:", error.message);
    return;
  }
  console.log("Fetched leads count:", leads?.length);
  console.log("Leads list:", leads?.map(l => ({ id: l.id, business: l.business })));
}
run();
