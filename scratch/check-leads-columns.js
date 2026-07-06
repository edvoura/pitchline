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

async function checkColumn(colName) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase.from("leads").select(colName).limit(1);
  if (error) {
    console.log(`Column '${colName}': FAILED -`, error.message);
    return false;
  } else {
    console.log(`Column '${colName}': EXISTS`);
    return true;
  }
}

async function run() {
  await checkColumn("phone");
  await checkColumn("preferred_channel");
  await checkColumn("whatsapp_link");
}
run();
