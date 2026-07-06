import fs from "fs";
import path from "path";

function findFile(dir, name) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!file.startsWith(".") && file !== "node_modules") {
          const found = findFile(fullPath, name);
          if (found) return found;
        }
      } else if (file === name) {
        return fullPath;
      }
    }
  } catch (e) {}
  return null;
}

const configDir = "C:/Users/Akinola Olujobi/.gemini";
console.log("Searching in:", configDir);
const found = findFile(configDir, "outreach-channel-addendum.md");
console.log("Found path:", found);
