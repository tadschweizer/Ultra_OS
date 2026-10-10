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
// Existing Vercel project's root is webapp. Static builders apply only to this
// deployment payload; project settings and production source are untouched.
if (process.env.DEMO_VERCEL_ROOT) {
  if (process.env.DEMO_VERCEL_ROOT !== "webapp") throw new Error("Unsupported deployment root");
  const config = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  config.builds = [{ src: "**", use: "@vercel/static" }];
  for (const file of files) {
    if (file.file === "vercel.json") file.data = Buffer.from(JSON.stringify(config)).toString("base64");
    file.file = `webapp/${file.file}`;
  }
}
const serialized = JSON.stringify(files);
const offset = Number(process.argv[2] || 0);
const length = Number(process.argv[3] || serialized.length);
process.stdout.write(serialized.slice(offset, offset + length));
