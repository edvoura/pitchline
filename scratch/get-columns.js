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

  // We can query postgrest schema info via RPC or just check why Rest API failed
  // Let's do a direct select with a query to templates and print the error details
  console.log("Selecting * from templates...");
  const { data, error } = await supabase.from("templates").select("*");
  if (error) {
    console.log("Templates select error:", error);
  } else {
    console.log("Success! Data:", data);
  }
}
run();
