import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { buildSeedData, seedPeople, seedId } from "../../scripts/seed-fixtures.mjs";

test("test fixtures load into the real app schema and remain consistent on rerun", async () => {
  const db = new PGlite();
  const userIds = Object.fromEntries(
    seedPeople.map((p) => [p.key, seedId(`auth-${p.key}`)]),
  );
  const now = new Date("2026-11-25T12:30:00+05:30");
  const fixture = buildSeedData(userIds, now);
  const second = buildSeedData(userIds, now);
  assert.deepEqual(fixture, second);
  assert.ok(fixture.attendance.length > 150);
  assert.ok(fixture.attendance.every((a) => +new Date(a.occurred_at) <= +now));
  assert.ok(fixture.corrections.some((c) => c.status === "approved"));
  assert.ok(fixture.corrections.some((c) => c.status === "rejected"));
  assert.equal(fixture.corrections.filter((c) => c.status === "pending").length, 2);
  assert.equal(fixture.members.filter((m) => m.role === "admin").length, 2);
  assert.equal(fixture.members.filter((m) => !m.is_active).length, 1);
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text not null,raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
    `);
    const sql = await readFile(
      new URL(
        "../../supabase/migrations/202611250001_attendance_buddy.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
    for (const person of seedPeople)
      await db.query(
        "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
        [userIds[person.key], person.email, { full_name: person.full_name }],
      );
    async function insert(table: string, rows: Record<string, unknown>[]) {
      for (const row of rows) {
        const keys = Object.keys(row);
        await db.query(
          `insert into public.${table} (${keys.map((k) => `"${k}"`).join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) on conflict do nothing`,
          keys.map((k) =>
            Array.isArray(row[k]) ? `{${(row[k] as number[]).join(",")}}` : row[k],
          ),
        );
      }
    }
    await insert("organizations", [fixture.organization]);
    for (const member of fixture.members)
      await db.query(
        "update public.profiles set org_id=$1,role=$2,is_active=$3 where id=$4",
        [member.org_id, member.role, member.is_active, member.id],
      );
    await insert("locations", fixture.locations);
    await insert("shifts", fixture.shifts);
    await insert("shift_members", fixture.assignments);
    await insert("attendance", fixture.attendance);
    await insert("corrections", fixture.corrections);
    await insert("invitations", fixture.invitations);
    await insert("audit_log", fixture.audit);
    await insert("attendance", fixture.attendance);
    const count = await db.query<{ count: number }>(
      "select count(*)::int as count from public.attendance",
    );
    assert.equal(count.rows[0].count, fixture.attendance.length);
    for (const correction of fixture.corrections) {
      const row = fixture.attendance.find((a) => a.id === correction.attendance_id)!;
      assert.equal(row.user_id, correction.user_id);
      if (correction.status === "approved") {
        assert.equal(row.occurred_at, correction.requested_time);
        assert.equal(row.corrected, true);
      }
    }
    // The history preserves check-in/out order, including overnight sessions.
    for (const member of fixture.members) {
      const records = fixture.attendance
        .filter((a) => a.user_id === member.id)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
      records.forEach((record, index) =>
        assert.equal(record.action, index % 2 === 0 ? "in" : "out"),
      );
    }
  } finally {
    await db.close();
  }
});
