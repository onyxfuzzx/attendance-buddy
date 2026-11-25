import { readFile, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { buildSeedData, seedPeople, seedId, SEED_VERSION } from "./seed-fixtures.mjs";

const config = {
  ...parseEnv(await readFile(new URL("../backend/.env", import.meta.url), "utf8")),
  ...process.env,
};
const url = config.SUPABASE_URL;
const key = config.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || /YOUR_/.test(url + key))
  throw new Error(
    "Add SUPABASE_SERVICE_ROLE_KEY to backend/.env. The public key cannot create test accounts.",
  );
const project = new URL(url);
if (project.protocol !== "https:" || !project.hostname.endsWith(".supabase.co"))
  throw new Error("Expected an HTTPS Supabase project URL.");
let privileged = key.startsWith("sb_secret_");
try {
  if (key.startsWith("eyJ"))
    privileged =
      JSON.parse(Buffer.from(key.split(".")[1], "base64url")).role === "service_role";
} catch {
  /* Rejected below. */
}
if (!privileged)
  throw new Error(
    "The seed needs a server-only secret or service-role key, not a publishable/anon key.",
  );
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(30000) }),
  },
});
const credentialsPath = new URL("../backend/.seed-accounts.json", import.meta.url);
let credentials = {
  project: project.hostname,
  workspace: "Attendance Buddy Test Lab",
  seeded_at: new Date().toISOString(),
  accounts: [],
};
try {
  credentials = JSON.parse(await readFile(credentialsPath, "utf8"));
  if (credentials.project !== project.hostname)
    throw new Error(
      "Existing seed credentials belong to another project. Move that file before seeding a new project.",
    );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
async function saveCredentials() {
  await writeFile(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", {
    mode: 0o600,
  });
  if (process.platform !== "win32") await chmod(credentialsPath, 0o600);
}
function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
async function insert(table, rows, conflict = "id") {
  if (!rows.length) return;
  // Each batch is restartable. Existing fixture rows are left unchanged.
  for (let start = 0; start < rows.length; start += 100)
    checked(
      await admin.from(table).upsert(rows.slice(start, start + 100), {
        onConflict: conflict,
        ignoreDuplicates: true,
      }),
      `Seed ${table}`,
    );
}

// Verify the migration and workspace collision before creating any Auth accounts.
const existingOrg = checked(
  await admin
    .from("organizations")
    .select("id,name")
    .eq("id", seedId("organization"))
    .maybeSingle(),
  "Check seed workspace",
);
if (existingOrg && existingOrg.name !== credentials.workspace)
  throw new Error(
    "The seed workspace ID is already used by another workspace. No data was changed.",
  );
const existingMembers = checked(
  await admin
    .from("profiles")
    .select("id,email,org_id")
    .in(
      "email",
      seedPeople.map((p) => p.email),
    ),
  "Check test profiles",
);
// Preflight every collision so a non-fixture account is never repurposed.
for (const profile of existingMembers) {
  const authUser = checked(
    await admin.auth.admin.getUserById(profile.id),
    "Verify test identity",
  ).user;
  if (
    authUser.app_metadata.attendance_buddy_seed !== SEED_VERSION ||
    (profile.org_id && profile.org_id !== seedId("organization"))
  )
    throw new Error(
      `The reserved test email ${profile.email} is already in use by another account. No existing account will be changed.`,
    );
}
const userIds = {};
for (const person of seedPeople) {
  let profile = existingMembers.find((p) => p.email === person.email);
  if (!profile) {
    const password = `Buddy!${randomBytes(18).toString("base64url")}9a`;
    // Persist the generated password before account creation so a retry remains recoverable.
    let saved = credentials.accounts.find((a) => a.email === person.email);
    if (!saved) {
      saved = { email: person.email, password, role: person.role };
      credentials.accounts.push(saved);
      await saveCredentials();
    }
    const result = checked(
      await admin.auth.admin.createUser({
        email: person.email,
        password: saved.password,
        email_confirm: true,
        user_metadata: { full_name: person.full_name },
        app_metadata: { attendance_buddy_seed: SEED_VERSION },
      }),
      `Create ${person.full_name}`,
    );
    profile = { id: result.user.id, email: person.email };
    saved.user_id = profile.id;
    await saveCredentials();
  }
  userIds[person.key] = profile.id;
}
if (!credentials.seeded_at) {
  credentials.seeded_at = new Date().toISOString();
  await saveCredentials();
}
const fixture = buildSeedData(userIds, new Date(credentials.seeded_at));
await insert("organizations", [fixture.organization]);
// Only new profiles from this seed (with no workspace) are attached; reruns preserve changes.
for (const member of fixture.members) {
  const current = checked(
    await admin.from("profiles").select("org_id").eq("id", member.id).single(),
    "Read test profile",
  );
  if (!current.org_id)
    checked(
      await admin.from("profiles").update(member).eq("id", member.id).is("org_id", null),
      "Assign test profile",
    );
}
await insert("locations", fixture.locations);
await insert("shifts", fixture.shifts);
await insert("shift_members", fixture.assignments, "shift_id,user_id");
await insert("attendance", fixture.attendance);
// A correction approved by the fixture already has a corrected attendance row.
await insert("corrections", fixture.corrections);
await insert("invitations", fixture.invitations);
await insert("audit_log", fixture.audit);
const counts = {};
for (const table of [
  "profiles",
  "locations",
  "shifts",
  "attendance",
  "corrections",
  "invitations",
]) {
  const result = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("org_id", fixture.organization.id);
  checked(result, `Verify ${table}`);
  counts[table] = result.count;
}
// Verify an actual employee session uses RLS, rather than the privileged seed client.
const employee = credentials.accounts.find(
  (a) => a.email === seedPeople.find((p) => p.key === "priya").email,
);
if (employee && config.SUPABASE_ANON_KEY) {
  const client = createClient(url, config.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  checked(
    await client.auth.signInWithPassword({
      email: employee.email,
      password: employee.password,
    }),
    "Employee sign-in",
  );
  const visible = checked(
    await client.from("profiles").select("id"),
    "Employee profile access",
  );
  if (visible.length !== 1 || visible[0].id !== userIds.priya)
    throw new Error("Employee profile isolation check failed.");
  const visibleAttendance = checked(
    await client.from("attendance").select("user_id").limit(1000),
    "Employee attendance access",
  );
  if (visibleAttendance.some((a) => a.user_id !== userIds.priya))
    throw new Error("Employee attendance isolation check failed.");
  await client.auth.signOut();
  console.log("Verified employee sign-in and profile/attendance isolation.");
}
console.log(JSON.stringify({ workspace: fixture.organization.name, counts }));
console.log(
  "Test passwords are in backend/.seed-accounts.json (ignored by Git). No passwords or API keys were printed.",
);
console.log(
  "Seed users have confirmed test-only emails; no invitation or confirmation emails were sent.",
);
