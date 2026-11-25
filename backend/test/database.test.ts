import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL migration and critical access/attendance transactions", async (t) => {
  const db = new PGlite();
  const admin = crypto.randomUUID(),
    employee = crypto.randomUUID(),
    outsider = crypto.randomUUID();
  let org: string,
    otherOrg: string,
    loc: string,
    token: string,
    shift: string,
    attendanceId: string;
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text not null,raw_user_meta_data jsonb default '{}'::jsonb);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
   alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
   grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;
  `);
    const migration = await readFile(
      new URL(
        "../../supabase/migrations/202611250001_attendance_buddy.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await t.test("migration compiles on PostgreSQL", async () => {
      await db.exec(migration.replace("create extension if not exists pgcrypto;", ""));
    });
    async function login(user: string, email: string) {
      await db.exec("reset role");
      await db.query(
        `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,
        [user, JSON.stringify({ sub: user, email })],
      );
      await db.exec("set role authenticated");
    }
    async function scalar<T = string>(sql: string, params: unknown[] = []) {
      const r = await db.query<Record<string, T>>(sql, params);
      return Object.values(r.rows[0])[0];
    }
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6),($7,$8,$9)",
      [
        admin,
        "admin@team.test",
        { full_name: "Admin Person" },
        employee,
        "member@team.test",
        { full_name: "Team Member" },
        outsider,
        "outside@team.test",
        { full_name: "Other Admin" },
      ],
    );
    await t.test("bootstrap creates admin once and ignores role metadata", async () => {
      await login(admin, "admin@team.test");
      org = await scalar("select public.create_workspace($1,$2)", ["First Team", "UTC"]);
      assert.equal(
        await scalar(`select role from public.profiles where id=$1`, [admin]),
        "admin",
      );
      await assert.rejects(
        db.query("select public.create_workspace($1,$2)", ["Again", "UTC"]),
        /already belongs/,
      );
      await login(outsider, "outside@team.test");
      otherOrg = await scalar("select public.create_workspace($1,$2)", [
        "Other Team",
        "UTC",
      ]);
      assert.notEqual(org, otherOrg);
    });
    await t.test(
      "invitation enforces email ownership and assigns employee role",
      async () => {
        await login(admin, "admin@team.test");
        const invite = await scalar(
          `insert into public.invitations(org_id,email,full_name,department) values($1,'member@team.test','Team Member','Design') returning token`,
          [org],
        );
        await login(employee, "wrong@team.test");
        await assert.rejects(
          db.query("select public.accept_invitation($1)", [invite]),
          /another email/,
        );
        await login(employee, "member@team.test");
        await db.query("select public.accept_invitation($1)", [invite]);
        assert.equal(
          await scalar("select role from public.profiles where id=$1", [employee]),
          "employee",
        );
      },
    );
    await t.test("workspace isolation and privilege escalation are blocked", async () => {
      await login(employee, "member@team.test");
      assert.equal(
        await scalar<number>("select count(*)::int from public.organizations"),
        1,
      );
      assert.equal(await scalar<number>("select count(*)::int from public.profiles"), 1);
      await assert.rejects(
        db.query(`update public.profiles set role='admin' where id=$1`, [employee]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.set_member_active($1,false)", [admin]),
        /Administrator/,
      );
      await assert.rejects(
        db.query(
          `insert into public.locations(org_id,name,address,latitude,longitude,radius) values($1,'Bad','Bad address',12,77,100)`,
          [otherOrg],
        ),
        /row-level security/,
      );
    });
    await t.test(
      "admin creates workplace and cross-workspace shift members are rejected atomically",
      async () => {
        await login(admin, "admin@team.test");
        const r = await db.query<{ id: string; token: string }>(
          `insert into public.locations(org_id,name,address,latitude,longitude,radius) values($1,'Headquarters','Bengaluru',12.97,77.59,150) returning id,token`,
          [org],
        );
        loc = r.rows[0].id;
        token = r.rows[0].token;
        await assert.rejects(
          db.query("select public.create_shift($1)", [
            {
              name: "Bad shift",
              location_id: loc,
              start_time: "00:01",
              end_time: "23:59",
              days: [0, 1, 2, 3, 4, 5, 6],
              member_ids: [outsider],
            },
          ]),
          /outside this workspace/,
        );
        assert.equal(await scalar<number>("select count(*)::int from public.shifts"), 0);
        shift = await scalar("select public.create_shift($1)", [
          {
            name: "Everyday",
            location_id: loc,
            start_time: "00:01",
            end_time: "23:59",
            days: [0, 1, 2, 3, 4, 5, 6],
            member_ids: [employee],
          },
        ]);
      },
    );
    const payload = (extra: Record<string, unknown> = {}) => ({
      token,
      latitude: 12.97,
      longitude: 77.59,
      accuracy: 8,
      action: "in",
      ...extra,
    });
    await t.test(
      "attendance rejects poor GPS, outside boundary and missing assignment",
      async () => {
        await login(employee, "member@team.test");
        await assert.rejects(
          db.query("select public.mark_attendance($1)", [payload({ accuracy: 101 })]),
          /accuracy/,
        );
        await assert.rejects(
          db.query("select public.mark_attendance($1)", [payload({ latitude: 13.1 })]),
          /Move within/,
        );
        await login(admin, "admin@team.test");
        await assert.rejects(
          db.query("select public.mark_attendance($1)", [payload()]),
          /No assigned shift/,
        );
      },
    );
    await t.test(
      "paused shifts reject new check-ins and only admins can resume them",
      async () => {
        await login(admin, "admin@team.test");
        await db.query("select public.set_shift_active($1,false)", [shift]);
        await login(employee, "member@team.test");
        await assert.rejects(
          db.query("select public.mark_attendance($1)", [payload()]),
          /No assigned shift/,
        );
        await assert.rejects(
          db.query("select public.set_shift_active($1,true)", [shift]),
          /Administrator/,
        );
        await login(admin, "admin@team.test");
        await db.query("select public.set_shift_active($1,true)", [shift]);
      },
    );
    await t.test(
      "withdrawn invitation cannot be accepted and can be replaced",
      async () => {
        const guest = crypto.randomUUID();
        await db.exec("reset role");
        await db.query("insert into auth.users(id,email) values($1,$2)", [
          guest,
          "guest@team.test",
        ]);
        await login(admin, "admin@team.test");
        const invitation = await db.query<{ id: string; token: string }>(
          `insert into public.invitations(org_id,email,full_name) values($1,'guest@team.test','Guest Person') returning id,token`,
          [org],
        );
        await db.query("select public.revoke_invitation($1)", [invitation.rows[0].id]);
        await login(guest, "guest@team.test");
        await assert.rejects(
          db.query("select public.accept_invitation($1)", [invitation.rows[0].token]),
          /expired or belongs/,
        );
        await login(admin, "admin@team.test");
        await db.query(
          `insert into public.invitations(org_id,email,full_name) values($1,'guest@team.test','Guest Person')`,
          [org],
        );
      },
    );
    await t.test(
      "database clock determines attendance and duplicate calls are rejected",
      async () => {
        await login(employee, "member@team.test");
        const r = await db.query<{
          record: { id: string; user_id: string; distance: number };
        }>("select to_jsonb(public.mark_attendance($1)) as record", [payload()]);
        attendanceId = r.rows[0].record.id;
        assert.equal(r.rows[0].record.user_id, employee);
        assert.equal(r.rows[0].record.distance, 0);
        await assert.rejects(
          db.query("select public.mark_attendance($1)", [payload()]),
          /30 seconds/,
        );
        await db.exec("reset role");
        await db.query(
          `update public.attendance set occurred_at=now()-interval '2 minutes' where id=$1`,
          [attendanceId],
        );
        await login(employee, "member@team.test");
        await assert.rejects(
          db.query("select public.mark_attendance($1)", [payload()]),
          /already checked in/,
        );
        await assert.rejects(
          db.query(
            `insert into public.attendance(org_id,user_id,location_id,shift_id,action,status,latitude,longitude,distance,accuracy) values($1,$2,$3,$4,'in','on_time',12,77,0,1)`,
            [org, employee, loc, shift],
          ),
          /permission denied/,
        );
      },
    );
    await t.test(
      "correction approval is atomic and preserves original time",
      async () => {
        await login(employee, "member@team.test");
        const correction = await scalar(
          `insert into public.corrections(org_id,user_id,attendance_id,requested_time,reason) values($1,$2,$3,now()-interval '3 minutes','My phone was offline at arrival.') returning id`,
          [org, employee, attendanceId],
        );
        await assert.rejects(
          db.query("select public.review_correction($1,$2,$3)", [
            correction,
            "approved",
            "Confirmed",
          ]),
          /Administrator/,
        );
        await login(admin, "admin@team.test");
        await db.query("select public.review_correction($1,$2,$3)", [
          correction,
          "approved",
          "Arrival confirmed by team lead",
        ]);
        assert.equal(
          await scalar("select corrected from public.attendance where id=$1", [
            attendanceId,
          ]),
          true,
        );
        assert.ok(
          await scalar("select original_at from public.attendance where id=$1", [
            attendanceId,
          ]),
        );
        await assert.rejects(
          db.query("select public.review_correction($1,$2,$3)", [
            correction,
            "approved",
            "Again",
          ]),
          /Pending request not found/,
        );
      },
    );
    await t.test(
      "overnight checkout uses the starting day and marks early departure",
      async () => {
        await db.exec("reset role");
        await db.query(
          `update public.shifts set start_time='22:00',end_time='21:00' where id=$1`,
          [shift],
        );
        await db.query(
          `update public.attendance set occurred_at=(current_date-1+time '23:00') at time zone 'UTC' where id=$1`,
          [attendanceId],
        );
        await login(employee, "member@team.test");
        const r = await db.query<{
          record: { action: string; status: string };
        }>("select to_jsonb(public.mark_attendance($1)) as record", [
          payload({ action: "out" }),
        ]);
        assert.equal(r.rows[0].record.action, "out");
        const hour = new Date().getUTCHours();
        assert.equal(r.rows[0].record.status, hour < 21 ? "early" : "on_time");
      },
    );
    await t.test(
      "suspension revokes data access and audit log is immutable",
      async () => {
        await login(admin, "admin@team.test");
        assert.ok(
          (await scalar<number>("select count(*)::int from public.audit_log")) > 0,
        );
        await assert.rejects(
          db.query("delete from public.audit_log"),
          /permission denied/,
        );
        await db.query("select public.set_member_active($1,false)", [employee]);
        await login(employee, "member@team.test");
        assert.equal(
          await scalar<number>("select count(*)::int from public.attendance"),
          0,
        );
        await assert.rejects(
          db.query("select public.mark_attendance($1)", [payload()]),
          /Active workspace membership/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
