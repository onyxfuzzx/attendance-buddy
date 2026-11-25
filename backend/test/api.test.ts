import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  locationSchema,
  scanSchema,
  shiftSchema,
  correctionSchema,
} from "../src/schemas.js";
test("health is public and describes database configuration", async () => {
  const res = await request(createApp()).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "Attendance Buddy");
  assert.equal(typeof res.body.configured, "boolean");
  assert.equal(res.headers["x-powered-by"], undefined);
});
test("workspace fails closed without a configured identity provider", async () => {
  const old = process.env.SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  try {
    const res = await request(createApp()).get("/api/workspace");
    assert.equal(res.status, 503);
    assert.match(res.body.error, /Supabase/);
  } finally {
    if (old) process.env.SUPABASE_URL = old;
  }
});
test("configured API rejects anonymous requests before accessing records", async () => {
  const old = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-key";
  try {
    const res = await request(createApp()).get("/api/workspace");
    assert.equal(res.status, 401);
  } finally {
    if (old) process.env.SUPABASE_URL = old;
    else delete process.env.SUPABASE_URL;
    if (oldKey) process.env.SUPABASE_ANON_KEY = oldKey;
    else delete process.env.SUPABASE_ANON_KEY;
  }
});
test("request schemas reject invalid coordinates, weak GPS and invalid shifts", () => {
  assert.equal(
    locationSchema.safeParse({
      name: "HQ",
      address: "Bengaluru",
      latitude: 91,
      longitude: 77,
      radius: 100,
    }).success,
    false,
  );
  assert.equal(
    scanSchema.safeParse({
      token: crypto.randomUUID(),
      latitude: 12,
      longitude: 77,
      accuracy: 101,
      action: "in",
    }).success,
    false,
  );
  assert.equal(
    shiftSchema.safeParse({
      name: "Morning",
      location_id: crypto.randomUUID(),
      start_time: "25:00",
      end_time: "18:00",
      days: [1],
      member_ids: [],
    }).success,
    false,
  );
  assert.equal(
    correctionSchema.safeParse({
      attendance_id: crypto.randomUUID(),
      reason: "x",
      requested_time: "today",
    }).success,
    false,
  );
});
