import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

let supabaseUrl = "";
let supabaseKey = "";

try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf-8");
  const urlMatch = envContent.match(/VITE_SUPABASE_URL\s%3D\s*(.+)/) || envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s%3D\s*(.+)/) || envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseKey = keyMatch[1].trim();
} catch (e) {
  console.log("Could not read .env.local:", e.message);
}

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch the demo for Test Business
  console.log("Fetching leads...");
  const { data: leads } = await supabase.from("leads").select("*");
  const testLead = leads?.find(l => l.business.toLowerCase().includes("test"));
  if (!testLead) {
    console.log("No test lead found. All leads:", leads);
    return;
  }
  console.log("Found Test Lead:", testLead.id, testLead.business);

  console.log("Fetching demo for lead...");
  const { data: demos, error } = await supabase.from("demos").select("*").eq("lead_id", testLead.id);
  if (error) {
    console.error("Error fetching demo:", error.message);
    return;
  }
  if (!demos || demos.length === 0) {
    console.log("No demo found in DB for this lead.");
    return;
  }
  const demo = demos[0];
  console.log("Demo Record found:");
  console.log("Provider:", demo.provider);
  console.log("HTML length:", demo.html?.length);
  console.log("HTML Preview (first 200 chars):", demo.html?.substring(0, 200));
  console.log("HTML Preview (last 200 chars):", demo.html?.substring(demo.html.length - 200));
}
run();
