import { useMemo, useState, type FormEvent } from "react";
import {
  Users,
  UserCheck,
  Clock3,
  CalendarDays,
  Plus,
  Download,
  ChevronRight,
  ChevronLeft,
  MapPin,
  ScanLine,
  ArrowUpRight,
  TrendingUp,
  Check,
  MessageSquareText,
  SlidersHorizontal,
  Building2,
  ShieldCheck,
  MoreHorizontal,
  CalendarCheck,
  Sun,
  CloudSun,
  Sparkles,
  Activity,
  CheckCircle2,
  Mail,
  Copy,
  RefreshCw,
  KeyRound,
} from "lucide-react";
import { useBuddy } from "./context";
import { Avatar, Badge, Empty, SearchBox, Select } from "./components";
import { dateKey, time, hours, exportCsv, supabase } from "./lib";
import type { Attendance } from "./types";

function Heading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">YOUR TEAM, IN SYNC</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function useFacts() {
  const { data } = useBuddy();
  const tz = data.organization!.timezone;
  const today = dateKey(new Date(), tz);
  const records = data.attendance.filter((a) => dateKey(a.occurred_at, tz) === today);
  const people = data.members.filter((m) => m.is_active);
  const present = new Set(records.filter((a) => a.action === "in").map((a) => a.user_id));
  const late = new Set(
    records.filter((a) => a.action === "in" && a.status === "late").map((a) => a.user_id),
  );
  return { tz, today, records, people, present, late };
}
export function Overview() {
  const { data, setPage, open } = useBuddy();
  const { tz, records, people, present, late } = useFacts();
  const admin = data.profile.role === "admin";
  const me = data.members.find((m) => m.id === data.profile.id)!;
  const [weekOffset, setWeekOffset] = useState(0);
  const [tab, setTab] = useState("Everyone");
  const pending = data.corrections.filter((c) => c.status === "pending").length;
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 6 + i - weekOffset * 7);
        const key = dateKey(d, tz);
        const rows = data.attendance.filter(
          (a) => dateKey(a.occurred_at, tz) === key && a.action === "in",
        );
        return {
          date: d,
          key,
          total: new Set(rows.map((a) => a.user_id)).size,
          late: new Set(rows.filter((a) => a.status === "late").map((a) => a.user_id))
            .size,
        };
      }),
    [data, tz, weekOffset],
  );
  const expected = days.reduce((sum, day) => {
    const weekday = new Date(day.key + "T12:00:00Z").getUTCDay();
    const scheduled = new Set(
      data.assignments
        .filter(
          (a) =>
            people.some((p) => p.id === a.user_id) &&
            data.shifts.some(
              (s) => s.id === a.shift_id && s.is_active && s.days.includes(weekday),
            ),
        )
        .map((a) => a.user_id),
    );
    return sum + scheduled.size;
  }, 0);
  const weeklyRate = expected
    ? Math.round((days.reduce((sum, day) => sum + day.total, 0) / expected) * 100)
    : 0;
  const chartDays = days;
  const todayRows = people
    .filter(
      (m) =>
        tab === "Everyone" ||
        (tab === "Checked in" && present.has(m.id)) ||
        (tab === "Not in yet" && !present.has(m.id)),
    )
    .slice(0, 5);
  return (
    <>
      <div className="page-heading overview-heading">
        <div>
          <div className="greeting-note">
            <Sun size={15} /> LET’S MAKE TODAY A GOOD ONE
          </div>
          <h1>
            Hey {me.full_name.split(" ")[0]}, looking good <span className="wave">✦</span>
          </h1>
          <p>
            Here’s what’s happening with {admin ? "your people" : "your attendance"}{" "}
            today.
          </p>
        </div>
        <div className="heading-actions">
          <span className="date-chip">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString("en-IN", {
              timeZone: tz,
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <button
            className="primary"
            onClick={() => (admin ? open("invite") : setPage("Check in"))}
          >
            <Plus size={17} />
            {admin ? "Invite a teammate" : "Check in"}
          </button>
        </div>
      </div>
      <section className="welcome-banner">
        <div className="banner-copy">
          <span className="banner-eyebrow">
            <span /> A LITTLE LESS ADMIN. A LOT MORE TOGETHER.
          </span>
          <h2>
            Great teams show up.
            <br />
            We make it effortless.
          </h2>
          <p>
            Your people, their time, and every little check-in.
            <br />
            All connected in one happy workspace.
          </p>
          <button onClick={() => setPage("Check in")}>
            <ScanLine size={17} />
            Let’s check in <ChevronRight size={16} />
          </button>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="banner-ring ring-a" />
          <div className="banner-ring ring-b" />
          <div className="banner-ring ring-c" />
          <div className="art-spark spark-a">✦</div>
          <div className="art-spark spark-b">✧</div>
          <div className="art-center">
            <Check strokeWidth={3.5} size={44} />
          </div>
          <div className="art-avatar art-avatar-a">PS</div>
          <div className="art-avatar art-avatar-b">DK</div>
          <div className="art-avatar art-avatar-c">AM</div>
          <div className="art-notification">
            <span>
              <Check size={13} />
            </span>
            <div>
              <strong>You’re right on time!</strong>
              <small>Another great day starts here.</small>
            </div>
          </div>
          <div className="art-label">
            <span /> All together. All in sync.
          </div>
        </div>
      </section>
      <section className="stats-grid">
        <Stat
          icon={<Users />}
          tone="violet"
          label={admin ? "Your people" : "My scheduled shifts"}
          value={admin ? people.length : data.assignments.length}
          detail={admin ? "People that make it happen" : "Assigned to you"}
          foot="Every person counts"
        />
        <Stat
          icon={<UserCheck />}
          tone="green"
          label="Checked in today"
          value={present.size}
          detail={`${people.length ? Math.round((present.size / people.length) * 100) : 0}% of ${admin ? "your team" : "your schedule"}`}
          foot="Ready to do great things"
        />
        <Stat
          icon={<Clock3 />}
          tone="amber"
          label="Running a little late"
          value={late.size}
          detail="After the 15-min grace period"
          foot="A little grace goes a long way"
        />
        <Stat
          icon={<CalendarCheck />}
          tone="blue"
          label="Attendance rate"
          value={`${Math.min(weeklyRate, 100)}%`}
          detail="Across the displayed week"
          foot="Showing up, together"
        />
      </section>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel chart-panel">
            <div className="section-heading">
              <div>
                <h2>
                  Showing up, together <span className="tiny-spark">✦</span>
                </h2>
                <p>A little look at your team’s attendance.</p>
              </div>
              <Select
                value={String(weekOffset)}
                onChange={(v) => setWeekOffset(Number(v))}
                label="Chart period"
              >
                <option value="0">Last 7 days</option>
                <option value="1">Previous 7 days</option>
                <option value="2">2 weeks ago</option>
                {weekOffset > 2 && (
                  <option value={String(weekOffset)}>{weekOffset} weeks ago</option>
                )}
              </Select>
            </div>
            <div className="chart-meta">
              <div>
                <strong>
                  {Math.min(weeklyRate, 100)}
                  <small>%</small>
                </strong>
                <span>weekly attendance</span>
              </div>
              <div className="chart-legend">
                <span>
                  <i />
                  On time
                </span>
                <span>
                  <i />
                  Late check-in
                </span>
              </div>
            </div>
            <div className="bar-chart">
              <div className="chart-grid">
                {[100, 75, 50, 25, 0].map((n) => (
                  <div key={n}>
                    <span>{n}%</span>
                    <i />
                  </div>
                ))}
              </div>
              <div className="chart-bars">
                {chartDays.map((day) => {
                  const total = people.length || 1;
                  return (
                    <div
                      className={`bar-column ${dateKey(day.date, tz) === dateKey(new Date(), tz) ? "today" : ""}`}
                      key={day.key}
                    >
                      <div
                        className="bar-space"
                        title={`${day.date.toLocaleDateString("en-IN")}: ${day.total} checked in, ${day.late} late`}
                      >
                        <div
                          className="bar-stack"
                          style={{
                            height: `${Math.max(0, Math.min(100, (day.total / total) * 100))}%`,
                          }}
                        >
                          <div
                            className="bar-late"
                            style={{
                              height: `${day.total ? (day.late / day.total) * 100 : 0}%`,
                            }}
                          />
                          <div className="bar-on-time" />
                        </div>
                      </div>
                      <span>
                        {day.date.toLocaleDateString("en-IN", {
                          weekday: "short",
                          timeZone: tz,
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="chart-footer">
              <span>
                <TrendingUp size={14} />
                Consistency looks good on your team.
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous week"
                  onClick={() => setWeekOffset((n) => n + 1)}
                >
                  <ChevronLeft size={15} />
                </button>
                <span>
                  {weekOffset
                    ? `${weekOffset} week${weekOffset > 1 ? "s" : ""} ago`
                    : "This week"}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next week"
                  disabled={weekOffset === 0}
                  onClick={() => setWeekOffset((n) => Math.max(0, n - 1))}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
          <section className="panel team-panel">
            <div className="section-heading">
              <div>
                <h2>{admin ? "The team, today" : "Your attendance, today"}</h2>
                <p>Every check-in has a person behind it.</p>
              </div>
              <button className="text-button" onClick={() => setPage("Attendance")}>
                View all <ChevronRight size={15} />
              </button>
            </div>
            <div className="tabs">
              {["Everyone", "Checked in", "Not in yet"].map((t) => (
                <button
                  className={tab === t ? "selected" : ""}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t}
                  {t === "Everyone" && <span>{people.length}</span>}
                </button>
              ))}
            </div>
            {todayRows.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>TEAM MEMBER</th>
                      <th>CHECK-IN</th>
                      <th>STATUS</th>
                      <th>WORKPLACE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayRows.map((m, i) => {
                      const record = records
                        .filter((a) => a.user_id === m.id && a.action === "in")
                        .at(-1);
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="person-cell">
                              <Avatar name={m.full_name} index={i} />
                              <div>
                                <strong>{m.full_name}</strong>
                                <small>{m.department}</small>
                              </div>
                            </div>
                          </td>
                          <td>{record ? time(record.occurred_at, tz) : "-"}</td>
                          <td>
                            <Badge
                              tone={
                                !record
                                  ? "gray"
                                  : record.status === "late"
                                    ? "amber"
                                    : "green"
                              }
                            >
                              {!record
                                ? "Not in yet"
                                : record.status === "late"
                                  ? "A little late"
                                  : "On time"}
                            </Badge>
                          </td>
                          <td>
                            <span className="location-cell">
                              <MapPin size={13} />
                              {data.locations.find((l) => l.id === record?.location_id)
                                ?.name || "-"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="A fresh start"
                text="Invite teammates and their daily attendance will appear here."
              />
            )}
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="panel schedule-panel">
            <div className="section-heading">
              <h2>On the schedule</h2>
              <span className="icon-pastel">
                <CalendarDays size={17} />
              </span>
            </div>
            <p className="section-subtitle">A little structure for a great day.</p>
            {data.shifts
              .filter((s) => s.is_active)
              .slice(0, 3)
              .map((s, i) => (
                <div className="schedule-item" key={s.id}>
                  <span className={`schedule-line line-${i}`} />
                  <div className="schedule-content">
                    <span className="schedule-time">
                      {s.start_time.slice(0, 5)}
                      <span> to </span>
                      {s.end_time.slice(0, 5)}
                    </span>
                    <h3>{s.name}</h3>
                    <p>
                      <MapPin size={12} />
                      {data.locations.find((l) => l.id === s.location_id)?.name}
                    </p>
                    <div className="schedule-people">
                      <div className="avatar-stack">
                        {data.assignments
                          .filter((a) => a.shift_id === s.id)
                          .slice(0, 3)
                          .map((a, i) => (
                            <Avatar
                              key={a.user_id}
                              name={
                                data.members.find((m) => m.id === a.user_id)?.full_name ||
                                "Member"
                              }
                              small
                              index={i}
                            />
                          ))}
                      </div>
                      <span>
                        {data.assignments.filter((a) => a.shift_id === s.id).length}{" "}
                        people scheduled
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            {!data.shifts.length && (
              <Empty
                title="Room for a routine"
                text="Create your first shift to get things moving."
              />
            )}
            <button
              className="full subtle-button"
              onClick={() => setPage(admin ? "Shifts" : "Attendance")}
            >
              View {admin ? "all shifts" : "my attendance"} <ChevronRight size={14} />
            </button>
          </section>
          <section className="request-callout">
            <span className="callout-icon">
              <MessageSquareText size={20} />
            </span>
            <span className="callout-count">{String(pending).padStart(2, "0")}</span>
            <h3>
              A little attention
              <br />
              goes a long way.
            </h3>
            <p>
              {pending
                ? `${pending} attendance requests are waiting for ${admin ? "your" : "admin"} review.`
                : "All requests are up to date. Your team is in good hands."}
            </p>
            <button onClick={() => setPage("Requests")}>
              Take a look <ChevronRight size={15} />
            </button>
            <span className="callout-decoration">✦</span>
          </section>
          <section className="panel activity-panel">
            <div className="section-heading">
              <h2>Little moments</h2>
              <Activity size={17} />
            </div>
            <p className="section-subtitle">The latest around your workspace.</p>
            {data.attendance.slice(0, 3).map((a, i) => (
              <div className="activity-row" key={a.id}>
                <Avatar
                  name={
                    data.members.find((m) => m.id === a.user_id)?.full_name || "Member"
                  }
                  index={i}
                  small
                />
                <div>
                  <p>
                    <strong>
                      {
                        data.members
                          .find((m) => m.id === a.user_id)
                          ?.full_name.split(" ")[0]
                      }
                    </strong>{" "}
                    checked {a.action === "in" ? "in" : "out"}{" "}
                    <span>{a.action === "in" ? "☀" : "✦"}</span>
                  </p>
                  <small>
                    {time(a.occurred_at, tz)} ·{" "}
                    {new Date(a.occurred_at).toLocaleDateString("en-IN", {
                      timeZone: tz,
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                </div>
              </div>
            ))}
            {!data.attendance.length && (
              <p className="muted">Your team’s first check-in will appear here.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
function Stat({
  icon,
  tone,
  label,
  value,
  detail,
  foot,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string | number;
  detail: string;
  foot: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className={`feature-icon ${tone}`}>{icon}</span>
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{detail}</span>
      </div>
      <div className="stat-foot">
        <span className={`mini-dot ${tone}`} />
        {foot}
      </div>
    </article>
  );
}

export function AttendancePage() {
  const { data, setPage, open, notify } = useBuddy();
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [location, setLocation] = useState("all"),
    [date, setDate] = useState(""),
    [page, setPageIndex] = useState(0);
  const tz = data.organization!.timezone;
  const filtered = data.attendance.filter((a) => {
    const member = data.members.find((m) => m.id === a.user_id);
    return (
      (!search || member?.full_name.toLowerCase().includes(search.toLowerCase())) &&
      (status === "all" || a.status === status) &&
      (location === "all" || a.location_id === location) &&
      (!date || dateKey(a.occurred_at, tz) === date)
    );
  });
  function exportData() {
    try {
      exportCsv(
        filtered.map((a) => ({
          Name: data.members.find((m) => m.id === a.user_id)?.full_name,
          Date: dateKey(a.occurred_at, tz),
          Time: time(a.occurred_at, tz),
          Action: a.action,
          Status: a.status,
          Workplace: data.locations.find((l) => l.id === a.location_id)?.name,
          Distance_m: Math.round(a.distance),
          Corrected: a.corrected ? "Yes" : "No",
        })),
        "attendance-buddy-records.csv",
      );
      notify("Attendance exported.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const current = Math.min(page, pages - 1);
  return (
    <>
      <Heading
        title="Every day, accounted for."
        subtitle="A clear picture of who showed up, when, and where."
      >
        <button className="secondary" onClick={exportData}>
          <Download size={16} />
          Export CSV
        </button>
        <button className="primary" onClick={() => setPage("Check in")}>
          <ScanLine size={16} />
          Check in / out
        </button>
      </Heading>
      <section className="panel">
        <div className="filter-bar">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPageIndex(0);
            }}
            placeholder="Find a team member…"
          />
          <div className="filter-controls">
            <input
              aria-label="Filter attendance date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPageIndex(0);
              }}
            />
            <Select
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPageIndex(0);
              }}
            >
              <option value="all">All statuses</option>
              <option value="on_time">On time</option>
              <option value="late">Late</option>
              <option value="early">Early departure</option>
            </Select>
            <Select
              label="Workplace"
              value={location}
              onChange={(v) => {
                setLocation(v);
                setPageIndex(0);
              }}
            >
              <option value="all">All workplaces</option>
              {data.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {(date || status !== "all" || location !== "all" || search) && (
              <button
                className="text-button"
                onClick={() => {
                  setDate("");
                  setStatus("all");
                  setLocation("all");
                  setSearch("");
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>TEAM MEMBER</th>
                    <th>DATE & TIME</th>
                    <th>ACTION</th>
                    <th>WORKPLACE</th>
                    <th>STATUS</th>
                    <th>VERIFICATION</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(current * 12, current * 12 + 12).map((a, i) => {
                    const member = data.members.find((m) => m.id === a.user_id);
                    return (
                      <tr key={a.id}>
                        <td>
                          <div className="person-cell">
                            <Avatar name={member?.full_name || "Member"} index={i} />
                            <div>
                              <strong>{member?.full_name}</strong>
                              <small>{member?.department}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong>{time(a.occurred_at, tz)}</strong>
                          <small className="block">
                            {new Date(a.occurred_at).toLocaleDateString("en-IN", {
                              timeZone: tz,
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </small>
                        </td>
                        <td>
                          <span className={`action-pill ${a.action}`}>
                            {a.action === "in" ? "Check-in" : "Check-out"}
                          </span>
                        </td>
                        <td>
                          {data.locations.find((l) => l.id === a.location_id)?.name}
                        </td>
                        <td>
                          <Badge tone={a.status === "on_time" ? "green" : "amber"}>
                            {a.status === "on_time"
                              ? "On time"
                              : a.status === "late"
                                ? "Late"
                                : "Left early"}
                          </Badge>
                          {a.corrected && <small className="block">Corrected</small>}
                        </td>
                        <td>
                          <span className="verified">
                            <ShieldCheck size={14} />
                            {Math.round(a.distance)}m from workplace
                          </span>
                          {a.photo_path && (
                            <button
                              className="text-button photo-view"
                              onClick={() => open("photo", a.id)}
                            >
                              View photo
                            </button>
                          )}
                        </td>
                        <td>
                          {a.user_id === data.profile.id && (
                            <button
                              className="text-button"
                              onClick={() => open("request", a.id)}
                            >
                              Request correction
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {current * 12 + 1} to {Math.min((current + 1) * 12, filtered.length)} of{" "}
                {filtered.length} records <small>· Latest 1,000 records</small>
              </span>
              <div className="pagination">
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={current === 0}
                  onClick={() => setPageIndex(current - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <span>
                  {current + 1} / {pages}
                </span>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={current === pages - 1}
                  onClick={() => setPageIndex(current + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="No check-ins match that"
            text="Try changing your filters, or make your first check-in."
          />
        )}
      </section>
    </>
  );
}
export function Team() {
  const { data, open, mutate, notify } = useBuddy();
  const [search, setSearch] = useState(""),
    [department, setDepartment] = useState("all"),
    [busy, setBusy] = useState("");
  const people = data.members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) &&
      (department === "all" || m.department === department),
  );
  async function toggle(id: string, active: boolean) {
    setBusy(id);
    try {
      await mutate(`/members/${id}`, "PATCH", { is_active: active });
      notify(active ? "Teammate reactivated." : "Teammate deactivated.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Heading
        title="Good people. Great team."
        subtitle="A home for every person who makes things happen."
      >
        <button className="primary" onClick={() => open("invite")}>
          <Plus size={17} />
          Invite a teammate
        </button>
      </Heading>
      <div className="compact-stats">
        <span>
          <Users />
          {data.members.length} <small>people in your workspace</small>
        </span>
        <span>
          <UserCheck />
          {data.members.filter((m) => m.is_active).length} <small>active teammates</small>
        </span>
        <span>
          <Mail />
          {data.invitations.filter((i) => !i.accepted && !i.revoked).length}{" "}
          <small>open invitations</small>
        </span>
      </div>
      <section className="panel">
        <div className="filter-bar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search your people…"
          />
          <Select value={department} onChange={setDepartment} label="Department">
            <option value="all">All departments</option>
            {[...new Set(data.members.map((m) => m.department))].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </div>
        {people.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TEAM MEMBER</th>
                  <th>DEPARTMENT</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                  <th>ACCESS</th>
                </tr>
              </thead>
              <tbody>
                {people.map((m, i) => (
                  <tr key={m.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar name={m.full_name} index={i} />
                        <div>
                          <strong>
                            {m.full_name}
                            {m.id === data.profile.id && (
                              <small className="you-label">you</small>
                            )}
                          </strong>
                          <small>{m.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>{m.department}</td>
                    <td>{m.role === "admin" ? "Administrator" : "Team member"}</td>
                    <td>
                      <Badge tone={m.is_active ? "green" : "gray"}>
                        {m.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td>
                      {m.role !== "admin" && (
                        <button
                          className={m.is_active ? "danger-text" : "text-button"}
                          disabled={busy === m.id}
                          onClick={() => void toggle(m.id, !m.is_active)}
                        >
                          {busy === m.id
                            ? "Updating…"
                            : m.is_active
                              ? "Deactivate"
                              : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No teammates found"
            text="Try a different search or invite someone new."
          />
        )}
      </section>
      {data.invitations.some((i) => !i.accepted && !i.revoked) && (
        <section className="panel invitations">
          <div className="section-heading">
            <div>
              <h2>A seat at the table</h2>
              <p>
                Share an invitation link. Your teammate signs up with the invited email.
              </p>
            </div>
          </div>
          {data.invitations
            .filter((i) => !i.accepted && !i.revoked)
            .map((i) => (
              <div className="invite-row" key={i.id}>
                <span className="feature-icon violet">
                  <Mail size={18} />
                </span>
                <div>
                  <strong>{i.full_name}</strong>
                  <small>
                    {i.email} ·{" "}
                    {new Date(i.expires_at) < new Date()
                      ? "Expired"
                      : "Expires " + new Date(i.expires_at).toLocaleDateString("en-IN")}
                  </small>
                  <code className="invitation-code">{i.token}</code>
                </div>
                <button
                  className="secondary"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(`${location.origin}/?invite=${i.token}`)
                      .then(() => notify("Invitation link copied."))
                      .catch(() =>
                        notify(
                          "Clipboard unavailable. Open the invitation details to copy the code.",
                          true,
                        ),
                      );
                  }}
                >
                  <Copy size={14} />
                  Copy link
                </button>
                <button
                  className="danger-text"
                  onClick={async () => {
                    try {
                      await mutate(`/invitations/${i.id}/revoke`, "PATCH", {});
                      notify("Invitation withdrawn. You can create a fresh one anytime.");
                    } catch (e) {
                      notify((e as Error).message, true);
                    }
                  }}
                >
                  Withdraw
                </button>
              </div>
            ))}
        </section>
      )}
    </>
  );
}
export function Locations() {
  const { data, open, mutate, notify } = useBuddy();
  const [busy, setBusy] = useState("");
  async function toggle(id: string, active: boolean) {
    setBusy(id);
    try {
      await mutate(`/locations/${id}`, "PATCH", { is_active: active });
      notify(active ? "Workplace activated." : "Workplace paused.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Heading
        title="Great work happens here."
        subtitle="Real places. Clear boundaries. Check-ins you can trust."
      >
        <button className="primary" onClick={() => open("location")}>
          <Plus size={17} />
          Add a workplace
        </button>
      </Heading>
      <div className="location-grid">
        {data.locations.map((l, i) => (
          <article className="panel location-card" key={l.id}>
            <div className={`location-map map-${i % 3}`}>
              <div className="map-street s1" />
              <div className="map-street s2" />
              <div className="map-street s3" />
              <div className="map-park" />
              <span className="map-geofence">
                <MapPin size={28} />
              </span>
              <span className="map-caption">Illustrative geofence</span>
              <Badge tone={l.is_active ? "green" : "gray"}>
                {l.is_active ? "Active workplace" : "Paused"}
              </Badge>
            </div>
            <div className="location-details">
              <h2>{l.name}</h2>
              <p>
                <MapPin size={14} />
                {l.address}
              </p>
              <div className="location-metadata">
                <span>
                  <ShieldCheck size={16} />
                  {l.radius}m boundary
                </span>
                <span>
                  {data.shifts.filter((s) => s.location_id === l.id).length} shifts
                </span>
              </div>
              <small>
                {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
              </small>
              <div className="card-actions">
                <button
                  className="primary"
                  disabled={!l.is_active}
                  onClick={() => open("qr", l.id)}
                >
                  <ScanLine size={15} />
                  Workplace QR
                </button>
                <button
                  className="secondary"
                  disabled={busy === l.id}
                  onClick={() => void toggle(l.id, !l.is_active)}
                >
                  {l.is_active ? "Pause" : "Activate"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!data.locations.length && (
        <div className="panel">
          <Empty
            title="Give your team a place to be"
            text="Add your first workplace, set its GPS coordinates, and choose a check-in boundary."
          >
            <button className="primary" onClick={() => open("location")}>
              <Plus size={16} />
              Add a workplace
            </button>
          </Empty>
        </div>
      )}
    </>
  );
}
export function Shifts() {
  const { data, open, mutate, notify } = useBuddy();
  const [busy, setBusy] = useState("");
  async function toggle(id: string, active: boolean) {
    setBusy(id);
    try {
      await mutate(`/shifts/${id}`, "PATCH", { is_active: active });
      notify(
        active ? "Shift resumed." : "Shift paused. Existing attendance is preserved.",
      );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  return (
    <>
      <Heading
        title="Find your team’s rhythm."
        subtitle="Thoughtful schedules. Clear expectations. Better days together."
      >
        <button className="primary" onClick={() => open("shift")}>
          <Plus size={17} />
          Create a shift
        </button>
      </Heading>
      <div className="shift-grid">
        {data.shifts.map((s, i) => (
          <article className="panel shift-card" key={s.id}>
            <div className="shift-card-heading">
              <span className={`feature-icon ${["violet", "amber", "green"][i % 3]}`}>
                {i % 2 ? <Sun /> : <Clock3 />}
              </span>
              <Badge tone={s.is_active ? "violet" : "gray"}>
                {s.is_active ? "Recurring shift" : "Paused"}
              </Badge>
            </div>
            <h2>{s.name}</h2>
            <p>
              <MapPin size={14} />
              {data.locations.find((l) => l.id === s.location_id)?.name}
            </p>
            <div className="shift-hours">
              <div>
                <small>STARTS AT</small>
                <strong>{s.start_time.slice(0, 5)}</strong>
              </div>
              <span className="shift-dash" />
              <div>
                <small>WRAPS UP</small>
                <strong>{s.end_time.slice(0, 5)}</strong>
              </div>
              {s.end_time < s.start_time && <Badge tone="blue">Overnight</Badge>}
            </div>
            <div className="weekdays">
              {days.map((d, index) => (
                <span
                  key={index}
                  className={s.days.includes(index) ? "scheduled" : ""}
                  title={
                    [
                      "Sunday",
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                    ][index]
                  }
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="shift-members">
              <div className="avatar-stack">
                {data.assignments
                  .filter((a) => a.shift_id === s.id)
                  .slice(0, 4)
                  .map((a, index) => (
                    <Avatar
                      key={a.user_id}
                      name={
                        data.members.find((m) => m.id === a.user_id)?.full_name ||
                        "Member"
                      }
                      index={index}
                      small
                    />
                  ))}
              </div>
              <span>
                {data.assignments.filter((a) => a.shift_id === s.id).length} people
                assigned
              </span>
            </div>
            <div className="shift-grace">
              <ShieldCheck size={14} />
              15-minute check-in grace period
            </div>
            <button
              className="secondary shift-pause"
              disabled={busy === s.id}
              onClick={() => void toggle(s.id, !s.is_active)}
            >
              {busy === s.id ? "Updating…" : s.is_active ? "Pause shift" : "Resume shift"}
            </button>
          </article>
        ))}
      </div>
      {!data.shifts.length && (
        <div className="panel">
          <Empty
            title="Make time for good work"
            text="Create a shift and assign teammates so everyone knows where and when to show up."
          >
            <button className="primary" onClick={() => open("shift")}>
              Create your first shift
            </button>
          </Empty>
        </div>
      )}
    </>
  );
}
export function Requests() {
  const { data, open } = useBuddy();
  const [tab, setTab] = useState("pending");
  const rows = data.corrections.filter((c) => tab === "all" || c.status === tab);
  return (
    <>
      <Heading
        title="Let’s get the little things right."
        subtitle="A missed scan shouldn’t spoil a good day. Review and resolve corrections."
      >
        <button className="primary" onClick={() => open("request")}>
          <Plus size={17} />
          Request a correction
        </button>
      </Heading>
      <section className="panel">
        <div className="tabs request-tabs">
          {["pending", "approved", "rejected", "all"].map((t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t === "all" ? "All requests" : t[0].toUpperCase() + t.slice(1)}
              <span>
                {data.corrections.filter((c) => t === "all" || c.status === t).length}
              </span>
            </button>
          ))}
        </div>
        {rows.length ? (
          <div className="request-list">
            {rows.map((c) => {
              const m = data.members.find((m) => m.id === c.user_id);
              const record = data.attendance.find((a) => a.id === c.attendance_id);
              return (
                <article className="request-item" key={c.id}>
                  <div className="request-top">
                    <div className="person-cell">
                      <Avatar name={m?.full_name || "Member"} />
                      <div>
                        <strong>{m?.full_name}</strong>
                        <small>
                          {m?.department} ·{" "}
                          {new Date(c.created_at).toLocaleDateString("en-IN")}
                        </small>
                      </div>
                    </div>
                    <Badge
                      tone={
                        c.status === "pending"
                          ? "amber"
                          : c.status === "approved"
                            ? "green"
                            : "gray"
                      }
                    >
                      {c.status}
                    </Badge>
                  </div>
                  <p>{c.reason}</p>
                  <div className="correction-times">
                    <span>
                      Recorded{" "}
                      <strong>
                        {record
                          ? time(record.occurred_at, data.organization!.timezone)
                          : "-"}
                      </strong>
                    </span>
                    <ChevronRight size={17} />
                    <span>
                      Requested{" "}
                      <strong>
                        {time(c.requested_time, data.organization!.timezone)}
                      </strong>
                    </span>
                    <small>
                      {new Date(c.requested_time).toLocaleDateString("en-IN", {
                        timeZone: data.organization!.timezone,
                        day: "numeric",
                        month: "short",
                      })}
                    </small>
                  </div>
                  {c.review_note && (
                    <p className="review-note">
                      <MessageSquareText size={15} />
                      {c.review_note}
                    </p>
                  )}
                  {c.status === "pending" &&
                    data.profile.role === "admin" &&
                    c.user_id !== data.profile.id && (
                      <button className="secondary" onClick={() => open("review", c.id)}>
                        Review request <ChevronRight size={15} />
                      </button>
                    )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty
            title={
              tab === "pending"
                ? "A clean slate. A good feeling."
                : "No requests here yet"
            }
            text={
              tab === "pending"
                ? "There are no attendance corrections waiting for review."
                : "Requests will appear here when their status matches this view."
            }
          />
        )}
      </section>
    </>
  );
}
export function Reports() {
  const { data, notify } = useBuddy();
  const [range, setRange] = useState("30");
  const tz = data.organization!.timezone;
  const cutoff = Date.now() - +range * 86400000;
  const rows = data.attendance.filter((a) => +new Date(a.occurred_at) >= cutoff);
  const people = data.members.map((m) => {
    const own = rows.filter((a) => a.user_id === m.id);
    const ins = own.filter((a) => a.action === "in");
    return {
      name: m.full_name,
      department: m.department,
      days: new Set(ins.map((a) => dateKey(a.occurred_at, tz))).size,
      late: ins.filter((a) => a.status === "late").length,
      hours: hours(own),
      onTime: ins.length
        ? Math.round(
            (ins.filter((a) => a.status === "on_time").length / ins.length) * 100,
          )
        : 0,
    };
  });
  const totalHours = hours(rows);
  function download() {
    try {
      exportCsv(
        people.map((p) => ({
          Name: p.name,
          Department: p.department,
          Days_present: p.days,
          Late_checkins: p.late,
          Completed_hours: p.hours.toFixed(2),
          On_time_percent: p.onTime,
        })),
        "attendance-buddy-summary.csv",
      );
      notify("Your team summary is ready.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <>
      <Heading
        title="See the bigger picture."
        subtitle="Real attendance data. Useful insights. Better decisions for your people."
      >
        <Select label="Report range" value={range} onChange={setRange}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
        <button className="primary" onClick={download}>
          <Download size={16} />
          Export summary
        </button>
      </Heading>
      <div className="stats-grid report-stats">
        <Stat
          label="Completed work hours"
          icon={<Clock3 />}
          tone="violet"
          value={totalHours.toFixed(1)}
          detail="From paired check-ins and check-outs"
          foot="Open sessions are excluded"
        />
        <Stat
          label="Days people showed up"
          icon={<UserCheck />}
          tone="green"
          value={people.reduce((sum, p) => sum + p.days, 0)}
          detail="Total person-days in this period"
          foot="Every day makes a difference"
        />
        <Stat
          label="Late check-ins"
          icon={<Sun />}
          tone="amber"
          value={people.reduce((sum, p) => sum + p.late, 0)}
          detail="Beyond the shift grace period"
          foot="Useful context, without the guesswork"
        />
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Your team, by the numbers</h2>
            <p>
              Last {range} days · {tz} · Based on the latest 1,000 attendance records
            </p>
          </div>
          <ChartNoAxesCombinedIcon />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>PERSON</th>
                <th>DEPARTMENT</th>
                <th>DAYS PRESENT</th>
                <th>COMPLETED HOURS</th>
                <th>LATE CHECK-INS</th>
                <th>ON-TIME RATE</th>
              </tr>
            </thead>
            <tbody>
              {people.map((p, i) => (
                <tr key={p.name}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={p.name} index={i} />
                      <strong>{p.name}</strong>
                    </div>
                  </td>
                  <td>{p.department}</td>
                  <td>{p.days}</td>
                  <td>{p.hours.toFixed(1)} hrs</td>
                  <td>{p.late}</td>
                  <td>
                    <div className="progress-cell">
                      <span className="progress">
                        <i style={{ width: `${p.onTime}%` }} />
                      </span>
                      <strong>{p.onTime}%</strong>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="info-note">
        <ShieldCheck size={18} />
        <p>
          Reports use your workspace’s local dates and completed attendance pairs. Open
          sessions are counted after check-out. These figures are attendance summaries;
          payroll rules are managed separately.
        </p>
      </div>
      {data.profile.role === "admin" && <AuditTrail />}
    </>
  );
}
function ChartNoAxesCombinedIcon() {
  return <TrendingUp size={20} className="muted" />;
}
function AuditTrail() {
  const { data } = useBuddy();
  const [search, setSearch] = useState("");
  const rows = data.audit.filter((a) =>
    `${a.action} ${a.entity} ${data.members.find((m) => m.id === a.actor_id)?.full_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <section className="panel audit-panel">
      <div className="section-heading">
        <div>
          <h2>A clear trail of little changes</h2>
          <p>
            Latest 100 workspace events. Recorded automatically and protected from edits.
          </p>
        </div>
        <ShieldCheck size={19} className="muted" />
      </div>
      <div className="filter-bar">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Find an action or person…"
        />
      </div>
      {rows.length ? (
        <div className="table-scroll audit-table">
          <table>
            <thead>
              <tr>
                <th>WHEN</th>
                <th>PERSON</th>
                <th>ACTION</th>
                <th>AREA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    {new Date(a.created_at).toLocaleString("en-IN", {
                      timeZone: data.organization!.timezone,
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td>
                    {data.members.find((m) => m.id === a.actor_id)?.full_name ||
                      "Workspace service"}
                  </td>
                  <td>
                    {a.action === "insert"
                      ? "Created"
                      : a.action === "update"
                        ? "Updated"
                        : a.action.replaceAll("_", " ")}
                  </td>
                  <td>{a.entity.replaceAll("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="A clear start"
          text="Workspace changes appear here as your team gets going."
        />
      )}
    </section>
  );
}
export function SettingsPage() {
  const { data, mutate, notify, demo, reload } = useBuddy();
  const me = data.members.find((m) => m.id === data.profile.id)!;
  const [busy, setBusy] = useState(false),
    [passwordBusy, setPasswordBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      await mutate("/profile", "PATCH", {
        full_name: form.get("full_name"),
        department: form.get("department"),
      });
      notify("Your profile feels more like you.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (demo) {
      notify("Password changes are available in a connected workspace.", true);
      return;
    }
    const form = new FormData(e.currentTarget);
    const value = String(form.get("password"));
    if (value !== form.get("confirm")) {
      notify("The passwords don’t match.", true);
      return;
    }
    setPasswordBusy(true);
    try {
      const { error } = await supabase!.auth.updateUser({ password: value });
      if (error) throw error;
      notify("Password updated.");
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setPasswordBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Make yourself at home."
        subtitle="Your profile, your preferences, your little corner of the workspace."
      />
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>The person behind the check-in</h2>
          <p>A few details that help your team find you.</p>
          <div className="settings-avatar">
            <Avatar name={me.full_name} />
            <div>
              <strong>{me.full_name}</strong>
              <small>{me.email}</small>
              <Badge tone="violet">
                {me.role === "admin" ? "Administrator" : "Team member"}
              </Badge>
            </div>
          </div>
          <form onSubmit={save}>
            <label>
              Full name
              <input
                name="full_name"
                defaultValue={me.full_name}
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <label>
              Department
              <input name="department" defaultValue={me.department} maxLength={60} />
            </label>
            <label>
              Email address
              <input value={me.email} readOnly />
              <small>Your email is managed by Supabase authentication.</small>
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Saving…" : "Save your profile"}
            </button>
          </form>
        </section>
        <div>
          <section className="panel settings-panel">
            <h2>Your workspace</h2>
            <div className="setting-detail">
              <Building2 size={18} />
              <div>
                <small>WORKSPACE NAME</small>
                <strong>{data.organization!.name}</strong>
              </div>
            </div>
            <div className="setting-detail">
              <Clock3 size={18} />
              <div>
                <small>TIMEZONE</small>
                <strong>{data.organization!.timezone}</strong>
              </div>
            </div>
            <div className="setting-detail">
              <ShieldCheck size={18} />
              <div>
                <small>CONNECTION</small>
                <strong>
                  {demo
                    ? "Demo · stored on this device"
                    : "Supabase · authenticated workspace"}
                </strong>
              </div>
            </div>
            {demo && (
              <button
                className="secondary"
                onClick={() => {
                  localStorage.removeItem("buddy-demo-v1");
                  void reload();
                  notify("Demo workspace reset.");
                }}
              >
                <RefreshCw size={15} />
                Reset demo data
              </button>
            )}
          </section>
          <section className="panel settings-panel">
            <h2>
              <KeyRound size={18} />
              Keep your account yours
            </h2>
            <p>Use a strong password you don’t use anywhere else.</p>
            <form onSubmit={password}>
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Confirm password
                <input
                  name="confirm"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>
              <button className="secondary" disabled={passwordBusy}>
                {passwordBusy ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
