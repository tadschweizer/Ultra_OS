import fs from "node:fs";
import path from "node:path";
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else
      files.push({
        file: path.relative("dist", file).replaceAll("\\", "/"),
        data: fs.readFileSync(file).toString("base64"),
        encoding: "base64",
      });
  }
}
walk("dist");
files.push({
  file: "vercel.json",
  data: fs.readFileSync("vercel.json").toString("base64"),
  encoding: "base64",
});
const serialized = JSON.stringify(files);
const offset = Number(process.argv[2] || 0);
const length = Number(process.argv[3] || serialized.length);
process.stdout.write(serialized.slice(offset, offset + length));
