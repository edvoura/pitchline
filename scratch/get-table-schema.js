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

  // Since RPC or sql queries might not be exposed, let's try a direct query using postgres schema via postgrest if allowed,
  // or let's try to query the REST API directly to see if we can get a response about columns
  console.log("Fetching REST schema info from postgrest root...");
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`
      }
    });
    console.log("Swagger OpenAPI response status:", res.status);
    if (res.ok) {
      const spec = await res.json();
      console.log("Tables in OpenAPI spec:", Object.keys(spec.paths || {}));
      
      // Let's inspect columns for templates table
      const templatesPath = spec.paths?.["/templates"] || {};
      const parameters = templatesPath.get?.parameters || [];
      console.log("Templates GET Parameters:", parameters.map(p => p.name));
      
      const schema = spec.definitions?.templates || {};
      console.log("Templates columns in Schema definitions:", Object.keys(schema.properties || {}));

      // Let's inspect columns for demos table
      const demosSchema = spec.definitions?.demos || {};
      console.log("Demos columns in Schema definitions:", Object.keys(demosSchema.properties || {}));
    } else {
      console.log("Failed to fetch OpenAPI spec:", await res.text());
    }
  } catch (err) {
    console.error("Exception fetching spec:", err.message);
  }
}
run();
