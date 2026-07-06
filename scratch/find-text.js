import fs from "fs";
import readline from "readline";
import path from "path";

const logPath = path.resolve(
  "C:/Users/Akinola Olujobi/.gemini/antigravity/brain/be349f76-7648-42fc-99c7-628f0e4e6c2c/.system_generated/logs/transcript.jsonl"
);

async function search() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (line.toLowerCase().includes("outreach-channel") || line.toLowerCase().includes("whatsapp")) {
      console.log(`Line ${lineCount}: ${line.substring(0, 300)}...`);
    }
  }
}
search();
