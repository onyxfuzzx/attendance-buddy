import { createClient } from "@supabase/supabase-js";
import type { Attendance, Workspace } from "./types";
const env = import.meta.env;
export const supabase =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null;
export async function api<T>(route: string, method = "GET", body?: unknown): Promise<T> {
  const session = await supabase?.auth.getSession();
  const response = await fetch(`${env.VITE_API_URL || ""}/api${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.data.session?.access_token || ""}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed. Please try again.");
  return result;
}
export function dateKey(date: Date | string, tz = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
export const time = (value: string, tz = "Asia/Kolkata") =>
  new Date(value).toLocaleTimeString("en-IN", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  });
export const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const uid = () => crypto.randomUUID();
export function hours(records: Attendance[]) {
  let total = 0;
  const open = new Map<string, number>();
  for (const r of [...records].sort((a, b) =>
    a.occurred_at.localeCompare(b.occurred_at),
  )) {
    if (r.action === "in") open.set(r.user_id, +new Date(r.occurred_at));
    else if (open.has(r.user_id)) {
      total += (+new Date(r.occurred_at) - open.get(r.user_id)!) / 3600000;
      open.delete(r.user_id);
    }
  }
  return total;
}
export function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) throw new Error("There are no records to export.");
  const quote = (s: unknown) => {
    let value = String(s ?? "");
    if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
    return '"' + value.replaceAll('"', '""') + '"';
  };
  const keys = Object.keys(rows[0]);
  const text = [
    keys.map(quote).join(","),
    ...rows.map((row) => keys.map((k) => quote(row[k])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function seedDemo(): Workspace {
  const org = "demo-workspace";
  const names = [
    ["Alex Morgan", "People & Culture"],
    ["Priya Sharma", "Design"],
    ["Daniel Kim", "Engineering"],
    ["Sofia Martinez", "Marketing"],
    ["James Wilson", "Engineering"],
    ["Aisha Patel", "Operations"],
    ["Oliver Chen", "Design"],
    ["Emma Thompson", "Marketing"],
    ["Arjun Mehta", "Engineering"],
    ["Mia Robinson", "Operations"],
    ["Noah Williams", "People & Culture"],
    ["Isabella Rossi", "Design"],
  ];
  const members = names.map(([full_name, department], i) => ({
    id: `demo-${i}`,
    org_id: org,
    full_name,
    department,
    email: full_name.toLowerCase().replace(" ", ".") + "@studio.co",
    role: (i === 0 ? "admin" : "employee") as "admin" | "employee",
    is_active: true,
    created_at: new Date().toISOString(),
  }));
  const locations = [
    {
      id: "loc-1",
      name: "The Studio · HQ",
      address: "Indiranagar, Bengaluru",
      latitude: 12.9784,
      longitude: 77.6408,
      radius: 150,
      token: uid(),
      is_active: true,
    },
    {
      id: "loc-2",
      name: "North workspace",
      address: "Hebbal, Bengaluru",
      latitude: 13.0358,
      longitude: 77.597,
      radius: 100,
      token: uid(),
      is_active: true,
    },
    {
      id: "loc-3",
      name: "Creative hub",
      address: "Koramangala, Bengaluru",
      latitude: 12.9352,
      longitude: 77.6245,
      radius: 120,
      token: uid(),
      is_active: true,
    },
  ];
  const shifts = [
    {
      id: "shift-1",
      name: "The everyday shift",
      location_id: "loc-1",
      start_time: "09:00",
      end_time: "18:00",
      days: [1, 2, 3, 4, 5],
      is_active: true,
    },
    {
      id: "shift-2",
      name: "Early birds",
      location_id: "loc-2",
      start_time: "07:00",
      end_time: "16:00",
      days: [1, 2, 3, 4, 5, 6],
      is_active: true,
    },
    {
      id: "shift-3",
      name: "Creative hours",
      location_id: "loc-3",
      start_time: "10:00",
      end_time: "19:00",
      days: [1, 2, 3, 4, 5],
      is_active: true,
    },
  ];
  const attendance: Attendance[] = [];
  const today = dateKey(new Date());
  for (let ago = 13; ago >= 0; ago--) {
    const day = new Date(today + "T12:00:00+05:30");
    day.setUTCDate(day.getUTCDate() - ago);
    const key = dateKey(day);
    if ([0, 6].includes(day.getUTCDay())) continue;
    members.forEach((m, i) => {
      if ((ago === 0 && i > 8) || (ago > 0 && (i + ago) % 9 === 0)) return;
      const late = (i + ago) % 7 === 0;
      const start = `${key}T${late ? "09:24" : `08:${String(46 + i).padStart(2, "0")}`}:00+05:30`;
      attendance.push({
        id: uid(),
        user_id: m.id,
        location_id: "loc-1",
        shift_id: "shift-1",
        action: "in",
        status: late ? "late" : "on_time",
        occurred_at: new Date(start).toISOString(),
        distance: 14 + i * 4,
        accuracy: 8,
      });
      if (ago > 0)
        attendance.push({
          id: uid(),
          user_id: m.id,
          location_id: "loc-1",
          shift_id: "shift-1",
          action: "out",
          status: "on_time",
          occurred_at: new Date(key + "T18:06:00+05:30").toISOString(),
          distance: 25,
          accuracy: 10,
        });
    });
  }
  const anomalous = attendance.filter((a) => a.status === "late").slice(-3);
  return {
    organization: {
      id: org,
      name: "Studio Collective",
      timezone: "Asia/Kolkata",
    },
    profile: { id: "demo-0", role: "admin", org_id: org },
    members,
    locations,
    shifts,
    attendance: attendance.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    corrections: anomalous.map((a, i) => ({
      id: uid(),
      user_id: a.user_id,
      attendance_id: a.id,
      reason: [
        "I arrived on time, but my phone lost its internet connection. Please update my check-in.",
        "The QR at the entrance was unavailable. My team lead can confirm my arrival.",
        "GPS took a while to connect inside the building. I was at my desk at 9.",
      ][i],
      requested_time: new Date(dateKey(a.occurred_at) + "T09:00:00+05:30").toISOString(),
      status: "pending",
      created_at: new Date().toISOString(),
    })),
    assignments: members.map((m) => ({ shift_id: "shift-1", user_id: m.id })),
    invitations: [],
    audit: [],
  };
}
export function loadDemo(): Workspace {
  try {
    const saved = localStorage.getItem("buddy-demo-v1");
    if (saved) {
      const parsed = JSON.parse(saved) as Workspace;
      parsed.shifts = parsed.shifts.map((s) => ({
        ...s,
        is_active: s.is_active ?? true,
      }));
      return parsed;
    }
  } catch {
    /* Reset malformed local demo data. */
  }
  return seedDemo();
}
