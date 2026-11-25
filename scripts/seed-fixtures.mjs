import { createHash } from "node:crypto";

export const SEED_VERSION = "attendance-buddy-test-v1";
export function seedId(name) {
  const hex = createHash("sha256").update(`${SEED_VERSION}:${name}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export const seedPeople = [
  {
    key: "alex",
    full_name: "Alex Morgan",
    email: "alex.morgan@attendance-buddy.test",
    department: "People & Culture",
    role: "admin",
    is_active: true,
    shift: 0,
  },
  {
    key: "sam",
    full_name: "Sam Taylor",
    email: "sam.taylor@attendance-buddy.test",
    department: "Operations",
    role: "admin",
    is_active: true,
    shift: 0,
  },
  {
    key: "priya",
    full_name: "Priya Sharma",
    email: "priya.sharma@attendance-buddy.test",
    department: "Design",
    role: "employee",
    is_active: true,
    shift: 0,
  },
  {
    key: "daniel",
    full_name: "Daniel Kim",
    email: "daniel.kim@attendance-buddy.test",
    department: "Engineering",
    role: "employee",
    is_active: true,
    shift: 0,
  },
  {
    key: "aisha",
    full_name: "Aisha Patel",
    email: "aisha.patel@attendance-buddy.test",
    department: "Operations",
    role: "employee",
    is_active: true,
    shift: 1,
  },
  {
    key: "emma",
    full_name: "Emma Thompson",
    email: "emma.thompson@attendance-buddy.test",
    department: "Marketing",
    role: "employee",
    is_active: true,
    shift: 2,
  },
  {
    key: "noah",
    full_name: "Noah Williams",
    email: "noah.williams@attendance-buddy.test",
    department: "Support",
    role: "employee",
    is_active: true,
    shift: 3,
  },
  {
    key: "oliver",
    full_name: "Oliver Chen",
    email: "oliver.chen@attendance-buddy.test",
    department: "Engineering",
    role: "employee",
    is_active: false,
    shift: 0,
  },
];

/** Pure fixtures. The loader supplies IDs returned by Supabase Auth's Admin API. */
export function buildSeedData(userIds, now = new Date()) {
  const org_id = seedId("organization");
  const organization = {
    id: org_id,
    name: "Attendance Buddy Test Lab",
    timezone: "Asia/Kolkata",
  };
  const members = seedPeople.map((p) => {
    if (!userIds[p.key]) throw new Error(`Missing Auth user ID for ${p.key}.`);
    return {
      id: userIds[p.key],
      org_id,
      full_name: p.full_name,
      email: p.email,
      department: p.department,
      role: p.role,
      is_active: p.is_active,
    };
  });
  const locations = [
    {
      id: seedId("location-hq"),
      name: "The Studio · Test HQ",
      address: "Sample pin · Bengaluru city centre",
      latitude: 12.9716,
      longitude: 77.5946,
      radius: 150,
    },
    {
      id: seedId("location-north"),
      name: "North Test Workspace",
      address: "Sample pin · Hebbal, Bengaluru",
      latitude: 13.0358,
      longitude: 77.597,
      radius: 100,
    },
    {
      id: seedId("location-creative"),
      name: "Creative Test Hub",
      address: "Sample pin · Koramangala, Bengaluru",
      latitude: 12.9352,
      longitude: 77.6245,
      radius: 120,
    },
  ].map((l) => ({ ...l, org_id, token: seedId(`qr-${l.id}`), is_active: true }));
  const shifts = [
    {
      name: "The Everyday Shift",
      start_time: "09:00",
      end_time: "18:00",
      location_id: locations[0].id,
      days: [1, 2, 3, 4, 5],
    },
    {
      name: "Early Birds",
      start_time: "07:00",
      end_time: "16:00",
      location_id: locations[1].id,
      days: [1, 2, 3, 4, 5, 6],
    },
    {
      name: "Creative Hours",
      start_time: "10:00",
      end_time: "19:00",
      location_id: locations[2].id,
      days: [1, 2, 3, 4, 5],
    },
    {
      name: "Night Owls",
      start_time: "22:00",
      end_time: "06:00",
      location_id: locations[0].id,
      days: [0, 1, 2, 3, 4, 5, 6],
    },
    {
      name: "Archived Summer Schedule",
      start_time: "08:00",
      end_time: "17:00",
      location_id: locations[0].id,
      days: [1, 2, 3, 4, 5],
    },
  ].map((s, i) => ({ ...s, id: seedId(`shift-${i}`), org_id, is_active: i !== 4 }));
  const assignments = seedPeople
    .filter((p) => p.is_active)
    .map((p) => ({ shift_id: shifts[p.shift].id, user_id: userIds[p.key] }));
  const tzDate = (date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: organization.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  const today = tzDate(now);
  const dayPlus = (key, amount) => {
    const date = new Date(`${key}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  };
  const stamp = (date, time, minutes = 0) =>
    new Date(+new Date(`${date}T${time}:00+05:30`) + minutes * 60000).toISOString();
  const attendance = [];
  for (let ago = 20; ago >= 0; ago--) {
    const day = dayPlus(today, -ago);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    seedPeople.forEach((person, index) => {
      const shift = shifts[person.shift];
      // Oliver's history precedes deactivation; occasional absences keep the fixture realistic.
      if (
        !shift.days.includes(weekday) ||
        (!person.is_active && ago < 8) ||
        (index + ago) % 11 === 0
      )
        return;
      const loc = locations.find((l) => l.id === shift.location_id);
      const late = (index + ago) % 5 === 0;
      const early = (index + ago) % 8 === 0;
      const occurred_in = stamp(day, shift.start_time, late ? 25 : -5 + (index % 4));
      const endDay = shift.end_time < shift.start_time ? dayPlus(day, 1) : day;
      const occurred_out = stamp(endDay, shift.end_time, early ? -30 : 5);
      const shared = {
        org_id,
        user_id: userIds[person.key],
        location_id: loc.id,
        shift_id: shift.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        distance: 0,
        accuracy: 8,
        photo_path: null,
        corrected: false,
      };
      if (+new Date(occurred_in) <= +now)
        attendance.push({
          ...shared,
          id: seedId(`attendance-${person.key}-${day}-in`),
          action: "in",
          status: late ? "late" : "on_time",
          occurred_at: occurred_in,
        });
      if (+new Date(occurred_in) <= +now && +new Date(occurred_out) <= +now)
        attendance.push({
          ...shared,
          id: seedId(`attendance-${person.key}-${day}-out`),
          action: "out",
          status: early ? "early" : "on_time",
          occurred_at: occurred_out,
        });
    });
  }
  // Corrections use distinct employee records. Pending requests are always from completed days.
  const lateRecords = attendance
    .filter(
      (a) =>
        a.action === "in" &&
        a.status === "late" &&
        tzDate(new Date(a.occurred_at)) !== today &&
        members.find((m) => m.id === a.user_id)?.role === "employee",
    )
    .reverse();
  const reasons = [
    "My phone was offline when I arrived. My team lead confirmed my actual arrival.",
    "The entrance QR display was temporarily unavailable, so my scan was delayed.",
    "GPS took a while to connect inside the building. I was already at my desk.",
    "The requested time could not be confirmed against the shift handover notes.",
  ];
  const corrections = lateRecords.slice(0, 4).map((a, index) => {
    const requested_time = stamp(
      tzDate(new Date(a.occurred_at)),
      shifts.find((s) => s.id === a.shift_id).start_time,
    );
    const status = index < 2 ? "pending" : index === 2 ? "approved" : "rejected";
    const created_at = new Date(+new Date(a.occurred_at) + 5 * 60000).toISOString();
    const result = {
      id: seedId(`correction-${a.id}`),
      org_id,
      user_id: a.user_id,
      attendance_id: a.id,
      requested_time,
      reason: reasons[index],
      status,
      created_at,
      review_note:
        status === "pending"
          ? null
          : status === "approved"
            ? "Arrival confirmed by the shift lead. Time corrected."
            : "Please supply the shift lead's confirmation before resubmitting.",
      reviewed_by: status === "pending" ? null : userIds.sam,
      reviewed_at:
        status === "pending"
          ? null
          : new Date(+new Date(created_at) + 5 * 60000).toISOString(),
    };
    if (status === "approved")
      Object.assign(a, {
        original_at: a.occurred_at,
        occurred_at: requested_time,
        corrected: true,
        status: "on_time",
      });
    return result;
  });
  const invitations = [
    {
      id: seedId("invitation-open"),
      email: "mia.robinson@attendance-buddy.test",
      full_name: "Mia Robinson",
      department: "Design",
      accepted: false,
      revoked: false,
      expires_at: new Date(+now + 6 * 86400000).toISOString(),
    },
    {
      id: seedId("invitation-expired"),
      email: "arjun.mehta@attendance-buddy.test",
      full_name: "Arjun Mehta",
      department: "Engineering",
      accepted: false,
      revoked: false,
      expires_at: new Date(+now - 86400000).toISOString(),
    },
  ].map((i) => ({ ...i, org_id, token: seedId(`token-${i.id}`) }));
  const audit = [
    {
      id: seedId("seed-audit"),
      org_id,
      actor_id: userIds.alex,
      action: "test_data_loaded",
      entity: "workspace",
      details: { fixture: SEED_VERSION },
      created_at: now.toISOString(),
    },
  ];
  return {
    organization,
    members,
    locations,
    shifts,
    assignments,
    attendance,
    corrections,
    invitations,
    audit,
  };
}
