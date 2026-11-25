import { build } from "vite";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(root, "dist/pages");
if (!output.startsWith(path.resolve(root) + path.sep))
  throw new Error("Pages output must stay inside the project.");
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] || "attendance-buddy";
const base = process.env.BUDDY_BASE_PATH || `/${repository}/`;
if (!base.startsWith("/") || !base.endsWith("/") || base.includes(".."))
  throw new Error("Pages base must be an absolute path ending in a slash.");

await build({
  configFile: false,
  root: path.join(root, "website"),
  base,
  envDir: false,
  build: { outDir: output, emptyOutDir: true },
});
process.env.BUDDY_BASE_PATH = `${base}demo/`;
await build({
  root: path.join(root, "frontend"),
  configFile: path.join(root, "frontend/vite.config.ts"),
  mode: "pages-demo",
  build: { outDir: path.join(output, "demo"), emptyOutDir: true },
});
await writeFile(path.join(output, ".nojekyll"), "");
await writeFile(
  path.join(output, "404.html"),
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · Attendance Buddy</title><body style="font-family:system-ui;max-width:36rem;margin:15vh auto;padding:2rem;color:#142d35"><h1>Let’s get you back to your people.</h1><p>This page doesn’t exist.</p><a href="${base}">Return to Attendance Buddy</a></body></html>`,
);
await mkdir(path.join(output, "licenses"), { recursive: true });
for (const font of ["dm-sans", "manrope"])
  await cp(
    path.join(root, `node_modules/@fontsource/${font}/LICENSE`),
    path.join(output, "licenses", `${font}.txt`),
  );

// Public artifacts must never contain a checkout's private or project-specific configuration.
const forbidden = [];
for (const file of ["backend/.env", "frontend/.env"]) {
  try {
    const env = parseEnv(await readFile(path.join(root, file), "utf8"));
    for (const [name, value] of Object.entries(env))
      if (
        /KEY|SECRET|PASSWORD|SUPABASE_URL/.test(name) &&
        value.length > 15 &&
        !value.includes("YOUR_")
      )
        forbidden.push(value);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inspect(file);
    else if (/\.(html|js|css|json|svg|txt)$/.test(file)) {
      const content = await readFile(file, "utf8");
      if (
        forbidden.some((value) => content.includes(value)) ||
        /sb_secret_[A-Za-z0-9_-]{20,}/.test(content)
      )
        throw new Error(
          `Private configuration detected in ${path.relative(root, file)}. Publication stopped.`,
        );
    }
  }
}
await inspect(output);
console.log(
  `Public website and browser-local demo built at ${path.relative(root, output)} (base: ${base}). Configuration isolation checks passed.`,
);
