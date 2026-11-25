import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const backendPath = new URL("../backend/.env", import.meta.url);
const frontendPath = new URL("../frontend/.env", import.meta.url);
const config = parseEnv(await readFile(backendPath, "utf8"));
const url = config.SUPABASE_URL;
const key = config.SUPABASE_ANON_KEY;
if (!url || !key || /YOUR_/.test(url + key)) {
  throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY in backend/.env first.");
}
const parsedUrl = new URL(url);
if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co")) {
  throw new Error("Expected an HTTPS Supabase project URL.");
}
let publicKey = key.startsWith("sb_publishable_");
if (key.startsWith("eyJ")) {
  try {
    publicKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role === "anon";
  } catch { /* Invalid key format is rejected below. */ }
}
if (!publicKey) {
  throw new Error("Use a publishable or anon key. Secret/service-role keys must not reach the frontend.");
}
if (process.argv.includes("--sync")) {
  let source;
  try { source = await readFile(frontendPath, "utf8"); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    source = await readFile(new URL("../frontend/.env.example", import.meta.url), "utf8");
  }
  for (const [name, value] of Object.entries({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key })) {
    const pattern = new RegExp(`^${name}=.*$`, "m");
    const line = `${name}=${value}`;
    source = pattern.test(source) ? source.replace(pattern, () => line) : `${source}\n${line}\n`;
  }
  await writeFile(frontendPath, source);
  console.log("Frontend Supabase URL and public key synchronized. No keys printed.");
}

async function probe(path) {
  try {
    const response = await fetch(new URL(path, url), {
      headers: { apikey: key }, signal: AbortSignal.timeout(15000),
    });
    let body;
    try { body = await response.json(); } catch { body = {}; }
    return { status: response.status, body };
  } catch (error) {
    return { status: 0, body: { code: error.cause?.code || error.name } };
  }
}
const auth = await probe("/auth/v1/settings");
console.log(JSON.stringify({ check: "Supabase Auth", status: auth.status, emailSignInEnabled: auth.body.external?.email ?? null }));
const tables = ["organizations", "profiles", "locations", "shifts", "shift_members", "attendance", "corrections", "invitations", "audit_log"];
const results = await Promise.all(tables.map(async table => {
  const result = await probe(`/rest/v1/${table}?select=*&limit=0`);
  const state = result.body.code === "42501" ? "present; anonymous access denied" :
    result.body.code === "PGRST205" ? "not available in API schema cache" : result.status === 200 ? "anonymous read permitted; review permissions" : "unverified";
  return { table, state, status: result.status, code: result.body.code || null };
}));
results.forEach(result => console.log(JSON.stringify(result)));
if (auth.status !== 200 || results.some(result => result.state !== "present; anonymous access denied")) process.exitCode = 1;
console.log("These read-only checks do not replace a signed-in attendance acceptance test.");
