import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Clock3,
  MapPin,
  MessageSquareText,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ScanLine,
  LogOut,
  Menu,
  X,
  Check,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  LifeBuoy,
  ChevronRight,
} from "lucide-react";
import type { Page, Workspace, Attendance } from "./types";
import { api, supabase, loadDemo, uid } from "./lib";
import { Context } from "./context";
import { Avatar, Brand, Modal } from "./components";
import {
  Overview,
  AttendancePage,
  Team,
  Locations,
  Shifts,
  Requests,
  Reports,
  SettingsPage,
} from "./pages";
import { Forms } from "./forms";
import { Scanner } from "./scanner";

const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Attendance", icon: CalendarCheck },
  { name: "Team", icon: Users },
  { name: "Shifts", icon: Clock3 },
  { name: "Locations", icon: MapPin },
  { name: "Requests", icon: MessageSquareText },
  { name: "Reports", icon: ChartNoAxesCombined },
] as const;
const getPage = (): Page => {
  let name: string;
  try {
    name = decodeURIComponent(location.hash.slice(1));
  } catch {
    return "Overview";
  }
  return [...nav.map((n) => n.name), "Settings", "Check in"].includes(name)
    ? (name as Page)
    : "Overview";
};
const demoOnly = import.meta.env.VITE_DEMO_ONLY;
export default function App() {
  const [demo, setDemo] = useState(
    () => demoOnly || sessionStorage.getItem("buddy-mode") === "demo",
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [recovery, setRecovery] = useState(() => location.hash.includes("type=recovery"));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState("");
  const workspaceRequest = useRef(0);
  const [page, setPageState] = useState<Page>(getPage);
  const [modal, setModal] = useState<{ kind: string; id?: string } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [mobile, setMobile] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const reload = useCallback(async () => {
    const request = ++workspaceRequest.current;
    if (demo) {
      setData(loadDemo());
      setError("");
      setLoading(false);
      return;
    }
    try {
      const workspace = await api<Workspace>("/workspace");
      if (request === workspaceRequest.current) {
        setData(workspace);
        setError("");
      }
    } catch (e) {
      if (request === workspaceRequest.current) setError((e as Error).message);
    } finally {
      if (request === workspaceRequest.current) setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    if (demo) {
      setAuthenticated(true);
      void reload();
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let initialized = false;
    let sessionUserId: string | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const syncSession = (userId: string | null) => {
      if (!active || (initialized && userId === sessionUserId)) return;
      initialized = true;
      sessionUserId = userId;
      // A changed identity invalidates any workspace response still in flight.
      workspaceRequest.current++;
      clearTimeout(loadTimer);
      setData(null);
      setError("");
      setAuthenticated(!!userId);
      setLoading(!!userId);
      if (userId) {
        // Keep Supabase calls outside its auth-event callback and session lock.
        loadTimer = setTimeout(() => {
          if (active) void reload();
        }, 0);
      }
    };
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!initialized) syncSession(session?.user.id ?? null);
      })
      .catch(() => {
        if (!initialized) syncSession(null);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (_event === "PASSWORD_RECOVERY") setRecovery(true);
      syncSession(session?.user.id ?? null);
    });
    return () => {
      active = false;
      workspaceRequest.current++;
      clearTimeout(loadTimer);
      subscription.unsubscribe();
    };
  }, [demo, reload]);
  useEffect(() => {
    if (demo || !authenticated) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [demo, authenticated, reload]);
  useEffect(() => {
    const update = () => setPageState(getPage());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const setPage = (next: Page) => {
    location.hash = encodeURIComponent(next);
    setPageState(next);
    setMobile(false);
    setGlobalSearch("");
  };
  const close = useCallback(() => setModal(null), []);
  const open = (kind: string, id?: string) => setModal({ kind, id });
  async function mutate(route: string, method: string, body: unknown) {
    if (!demo) {
      await api(route, method, body);
      await reload();
      return;
    }
    const next = structuredClone(data!);
    const b = body as Record<string, any>;
    const id = route.split("/")[2];
    if (route === "/locations")
      next.locations.push({
        ...b,
        id: uid(),
        token: uid(),
        is_active: true,
      } as any);
    else if (route.startsWith("/locations/"))
      Object.assign(
        next.locations.find((l) => l.id === id)!,
        b,
      );
    else if (route === "/shifts") {
      const shiftId = uid();
      next.shifts.push({ ...b, id: shiftId, is_active: true } as any);
      b.member_ids.forEach((user_id: string) =>
        next.assignments.push({ shift_id: shiftId, user_id }),
      );
    } else if (route.startsWith("/shifts/"))
      Object.assign(
        next.shifts.find((s) => s.id === id)!,
        b,
      );
    else if (route === "/invitations")
      next.invitations.push({
        ...b,
        id: uid(),
        token: uid(),
        accepted: false,
        revoked: false,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      } as any);
    else if (route.startsWith("/invitations/"))
      next.invitations.find((i) => i.id === id)!.revoked = true;
    else if (route.startsWith("/members/"))
      Object.assign(
        next.members.find((m) => m.id === id)!,
        b,
      );
    else if (route === "/corrections") {
      if (
        next.corrections.some(
          (c) => c.attendance_id === b.attendance_id && c.status === "pending",
        )
      )
        throw new Error("A pending request already exists for this record.");
      next.corrections.unshift({
        ...b,
        id: uid(),
        user_id: next.profile.id,
        status: "pending",
        created_at: new Date().toISOString(),
      } as any);
    } else if (route.startsWith("/corrections/")) {
      const correction = next.corrections.find((c) => c.id === id)!;
      if (correction.user_id === next.profile.id)
        throw new Error("Another administrator must review your own correction.");
      Object.assign(correction, b);
      if (b.status === "approved") {
        const record = next.attendance.find((a) => a.id === correction.attendance_id)!;
        record.occurred_at = correction.requested_time;
        record.corrected = true;
        record.status = "on_time";
      }
    } else if (route === "/profile")
      Object.assign(
        next.members.find((m) => m.id === next.profile.id)!,
        b,
      );
    else if (route === "/attendance/scan") {
      const loc = next.locations.find((l) => l.token === b.token && l.is_active);
      if (!loc) throw new Error("Workplace not found.");
      const previous = next.attendance.find((a) => a.user_id === next.profile.id);
      if (previous && Date.now() - +new Date(previous.occurred_at) < 30000)
        throw new Error("Please wait 30 seconds between attendance actions.");
      if (b.action === "in" && previous?.action === "in")
        throw new Error("You are already checked in.");
      if (b.action === "out" && previous?.action !== "in")
        throw new Error("Check in before checking out.");
      next.attendance.unshift({
        id: uid(),
        user_id: next.profile.id,
        location_id: loc.id,
        shift_id: "shift-1",
        action: b.action,
        status: "on_time",
        occurred_at: new Date().toISOString(),
        distance: 18,
        accuracy: 8,
      } as Attendance);
    }
    next.audit.unshift({
      id: uid(),
      actor_id: next.profile.id,
      action: method === "POST" ? "insert" : "update",
      entity: route.split("/")[1],
      created_at: new Date().toISOString(),
    });
    localStorage.setItem("buddy-demo-v1", JSON.stringify(next));
    setData(next);
  }
  async function logout() {
    if (demoOnly) {
      window.location.assign(new URL("../", window.location.href));
      return;
    }
    if (demo) {
      sessionStorage.removeItem("buddy-mode");
      setDemo(false);
      setAuthenticated(false);
      setData(null);
    } else await supabase?.auth.signOut();
    setPage("Overview");
  }
  function startDemo() {
    sessionStorage.setItem("buddy-mode", "demo");
    setLoading(true);
    setDemo(true);
  }
  const toastElement = toast && (
    <div className={`toast ${toast.error ? "error" : ""}`} role="status">
      {toast.error ? <X size={18} /> : <Check size={18} />}
      <span>{toast.message}</span>
      <button onClick={() => setToast(null)} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  );
  if (loading || (authenticated && !data && !error))
    return (
      <div className="boot">
        <Brand />
        <LoaderCircle className="spin" />
        <p>Getting your workspace ready…</p>
      </div>
    );
  if (!authenticated || recovery)
    return (
      <>
        <Auth
          onDemo={startDemo}
          notify={notify}
          recovery={recovery}
          onRecovered={() => {
            setRecovery(false);
            setPage("Overview");
            void reload();
          }}
        />
        {toastElement}
      </>
    );
  if (error || !data)
    return (
      <div className="boot">
        <Brand />
        <h2>We couldn’t load your workspace</h2>
        <p>{error || "Please try again."}</p>
        <button
          className="primary"
          onClick={() => {
            setLoading(true);
            void reload();
          }}
        >
          Try again
        </button>
        <button className="text-button" onClick={logout}>
          Back to sign in
        </button>
      </div>
    );
  if (!data.organization)
    return <Onboarding reload={reload} notify={notify} logout={logout} />;
  const me = data.members.find((m) => m.id === data.profile.id)!;
  const admin = data.profile.role === "admin";
  const pending = data.corrections.filter((c) => c.status === "pending").length;
  const searchResults = [
    ...nav
      .filter((n) => admin || !["Team", "Shifts", "Locations"].includes(n.name))
      .filter((n) => n.name.toLowerCase().includes(globalSearch.toLowerCase()))
      .map((n) => ({
        name: n.name,
        detail: "Go to page",
        page: n.name as Page,
      })),
    ...data.members
      .filter((m) => m.full_name.toLowerCase().includes(globalSearch.toLowerCase()))
      .slice(0, 4)
      .map((m) => ({
        name: m.full_name,
        detail: m.department,
        page: (admin ? "Team" : "Settings") as Page,
      })),
  ];
  return (
    <Context.Provider value={{ data, demo, page, setPage, mutate, open, notify, reload }}>
      <div className="app-shell" inert={!!modal}>
        {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
        <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
          <Brand />
          <button className="workspace-switch" onClick={() => open("workspace")}>
            <span className="workspace-icon">
              S<span>✦</span>
            </span>
            <span>
              <strong>{data.organization.name}</strong>
              <small>Team workspace</small>
            </span>
            <ChevronDown size={15} />
          </button>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {nav
              .filter((n) => admin || !["Team", "Shifts", "Locations"].includes(n.name))
              .map((n) => (
                <button
                  key={n.name}
                  className={`nav-item ${page === n.name ? "active" : ""}`}
                  onClick={() => setPage(n.name)}
                >
                  <n.icon size={19} />
                  <span>{n.name}</span>
                  {n.name === "Requests" && pending > 0 && <b>{pending}</b>}
                  {page === n.name && <i />}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-promo">
              <div className="promo-symbol">
                <Sparkles size={21} />
                <span>✦</span>
              </div>
              <h3>
                Good days start
                <br />
                with a great team.
              </h3>
              <p>
                A little less admin.
                <br />A lot more together.
              </p>
              <button onClick={() => open("help")}>
                Meet your buddy <ChevronRight size={15} />
              </button>
            </div>
            <button
              className={`nav-item ${page === "Settings" ? "active" : ""}`}
              onClick={() => setPage("Settings")}
            >
              <Settings size={19} />
              Settings
            </button>
            <button className="nav-item" onClick={() => open("help")}>
              <LifeBuoy size={19} />
              Help & getting started
            </button>
            <div className="sidebar-footer">
              <span className="tiny-brand">✦</span> Made for people, by people.
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                onClick={() => setMobile(!mobile)}
                aria-label="Toggle navigation"
              >
                <Menu size={21} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{page}</strong>
            </div>
            <div className="topbar-actions">
              <div className="global-search">
                <Search size={17} />
                <input
                  aria-label="Search pages and people"
                  placeholder="Search anything…"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                />
                <kbd>⌕</kbd>
                {globalSearch && (
                  <div className="search-results">
                    {searchResults.length ? (
                      searchResults.map((r, i) => (
                        <button key={i} onClick={() => setPage(r.page)}>
                          <span>
                            {r.name}
                            <small>{r.detail}</small>
                          </span>
                          <ChevronRight size={15} />
                        </button>
                      ))
                    ) : (
                      <p>No matching pages or people</p>
                    )}
                  </div>
                )}
              </div>
              <button
                className="notification-button icon-button"
                onClick={() => open("notifications")}
                aria-label={`${pending} pending requests`}
              >
                <Bell size={20} />
                {pending > 0 && <i />}
              </button>
              <span className="topbar-divider" />
              <button className="user-menu" onClick={() => open("account")}>
                <Avatar name={me?.full_name || "Member"} small />
                <span>
                  <strong>{me?.full_name}</strong>
                  <small>{admin ? "Workspace admin" : "Team member"}</small>
                </span>
                <ChevronDown size={14} />
              </button>
            </div>
          </header>
          {demo && (
            <div className="demo-strip">
              <span>
                <span className="demo-dot" />
                You’re exploring the demo workspace. Changes are saved on this device.
              </span>
              <button
                onClick={() =>
                  demoOnly
                    ? window.open(
                        "https://github.com/onyxfuzzx/attendance-buddy#quick-start",
                        "_blank",
                        "noopener,noreferrer",
                      )
                    : open("connect")
                }
              >
                {demoOnly ? "Get the open-source app" : "Connect your workspace"}{" "}
                <ChevronRight size={13} />
              </button>
            </div>
          )}
          <main className="content" key={page}>
            {page === "Overview" ? (
              <Overview />
            ) : page === "Attendance" ? (
              <AttendancePage />
            ) : page === "Team" && admin ? (
              <Team />
            ) : page === "Locations" && admin ? (
              <Locations />
            ) : page === "Shifts" && admin ? (
              <Shifts />
            ) : page === "Requests" ? (
              <Requests />
            ) : page === "Reports" ? (
              <Reports />
            ) : page === "Check in" ? (
              <Scanner />
            ) : (
              <SettingsPage />
            )}
            <footer className="main-footer">
              <span>Less paperwork. More people.</span>
              <span>
                <ShieldCheck size={13} /> Your workspace, protected.
              </span>
            </footer>
          </main>
        </div>
      </div>
      {modal &&
        (["location", "shift", "invite", "request", "review", "qr", "photo"].includes(
          modal.kind,
        ) ? (
          <Forms kind={modal.kind} id={modal.id} onClose={close} />
        ) : (
          <Modal
            title={
              modal.kind === "account"
                ? "Your account"
                : modal.kind === "notifications"
                  ? "Your attention, please"
                  : modal.kind === "connect"
                    ? "Make it your workspace"
                    : modal.kind === "workspace"
                      ? "Your team workspace"
                      : "A little help from your buddy"
            }
            onClose={close}
          >
            {modal.kind === "account" ? (
              <div className="account-panel">
                <Avatar name={me.full_name} />
                <h3>{me.full_name}</h3>
                <p>{me.email}</p>
                <button
                  className="secondary"
                  onClick={() => {
                    close();
                    setPage("Settings");
                  }}
                >
                  <Settings size={16} />
                  Profile & settings
                </button>
                <button className="danger-button" onClick={() => void logout()}>
                  <LogOut size={16} />
                  Sign out{demo ? " of demo" : ""}
                </button>
              </div>
            ) : modal.kind === "notifications" ? (
              <div className="dialog-body">
                <span className="feature-icon violet">
                  <MessageSquareText />
                </span>
                <h3>
                  {pending
                    ? `${pending} requests need a little attention`
                    : "You’re all caught up"}
                </h3>
                <p>
                  {pending
                    ? "Your team submitted attendance corrections. Open requests to review the details."
                    : "New attendance requests will appear here."}
                </p>
                <button
                  className="primary"
                  onClick={() => {
                    close();
                    setPage("Requests");
                  }}
                >
                  View requests
                </button>
              </div>
            ) : modal.kind === "connect" ? (
              <div className="dialog-body">
                <span className="feature-icon green">
                  <ShieldCheck />
                </span>
                <h3>Your team. Your Supabase project.</h3>
                <p>
                  Set the Supabase URL and publishable key in <code>frontend/.env</code>{" "}
                  and <code>backend/.env</code>, then run the included database migration.
                  Restart the app and create your account.
                </p>
                <p>The step-by-step setup is in the project README.</p>
                <button className="secondary" onClick={() => void logout()}>
                  Go to sign in
                </button>
              </div>
            ) : modal.kind === "workspace" ? (
              <div className="dialog-body">
                <h3>{data.organization.name}</h3>
                <p>
                  Timezone: {data.organization.timezone}
                  <br />
                  {data.members.filter((m) => m.is_active).length} active people ·{" "}
                  {data.locations.filter((l) => l.is_active).length} workplaces
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    close();
                    setPage("Settings");
                  }}
                >
                  Workspace settings
                </button>
              </div>
            ) : (
              <div className="help-steps">
                {[
                  [
                    "Make yourself at home",
                    "Your overview brings today’s attendance, schedule, and team activity together.",
                  ],
                  [
                    "Give your team a place to be",
                    "Add workplaces with GPS boundaries, then create shifts and invite people.",
                  ],
                  [
                    "Check in with confidence",
                    "Scan the workplace QR, verify your location, and record your attendance.",
                  ],
                  [
                    "Keep the details right",
                    "Missed or incorrect time? Submit a correction for your admin to review.",
                  ],
                ].map(([title, text], i) => (
                  <div key={title}>
                    <span>{i + 1}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        ))}
      {toastElement}
    </Context.Provider>
  );
}

function Auth({
  onDemo,
  notify,
  recovery,
  onRecovered,
}: {
  onDemo: () => void;
  notify: (m: string, e?: boolean) => void;
  recovery: boolean;
  onRecovered: () => void;
}) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false);
  const reset = recovery;
  const [forgot, setForgot] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) {
      notify("Connect Supabase to sign in, or explore the demo workspace.", true);
      return;
    }
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (reset) {
        const { error } = await supabase.auth.updateUser({
          password: String(f.get("password")),
        });
        if (error) throw error;
        notify("Password updated.");
        onRecovered();
      } else if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(
          String(f.get("email")),
          { redirectTo: location.origin },
        );
        if (error) throw error;
        setMessage("If an account exists for that email, a reset link is on its way.");
      } else if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email: String(f.get("email")),
          password: String(f.get("password")),
          options: {
            data: { full_name: String(f.get("full_name")) },
            emailRedirectTo: location.origin + location.search,
          },
        });
        if (error) throw error;
        if (!data.session)
          setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: String(f.get("email")),
          password: String(f.get("password")),
        });
        if (error) throw error;
      }
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <span className="eyebrow light">
            <Sparkles size={15} />A BETTER EVERYDAY
          </span>
          <h1>
            Your people.
            <br />
            Your places.
            <br />
            <em>In perfect sync.</em>
          </h1>
          <p>
            Meet the attendance workspace that puts people first. Simple check-ins.
            Happier teams. More room for the work that matters.
          </p>
          <div className="auth-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-check">
              <Check size={42} />
            </div>
            <span className="floating-person p1">PS</span>
            <span className="floating-person p2">DK</span>
            <span className="floating-person p3">AM</span>
            <span className="art-tag">
              <i /> Everyone’s in the loop.
            </span>
          </div>
          <div className="auth-trust">
            <ShieldCheck size={17} />
            Private by design. Built for every team.
          </div>
        </div>
        <small>ATTENDANCE BUDDY © {new Date().getFullYear()}</small>
      </section>
      <section className="auth-form-side">
        <div className="auth-top-note">
          A little less admin. A lot more together. <span>✦</span>
        </div>
        <div className="auth-form">
          <span className="welcome-wave">✦</span>
          <h2>
            {reset
              ? "A fresh start"
              : forgot
                ? "A little help getting back in."
                : signup
                  ? "Good things start here."
                  : "Hey, welcome back."}
          </h2>
          <p>
            {reset
              ? "Choose a new password for your account."
              : forgot
                ? "We’ll email you a link to reset your password."
                : signup
                  ? "Create your account. Bring your people together."
                  : "Your team’s day, all in one happy place."}
          </p>
          <form onSubmit={submit}>
            {signup && !forgot && (
              <label>
                Full name
                <input
                  name="full_name"
                  placeholder="Alex Morgan"
                  minLength={2}
                  maxLength={100}
                  required
                  autoComplete="name"
                />
              </label>
            )}
            {!reset && (
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  placeholder="you@yourteam.com"
                  required
                  autoComplete="email"
                />
              </label>
            )}
            {!forgot && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  autoComplete={signup || reset ? "new-password" : "current-password"}
                />
              </label>
            )}
            {message && <div className="inline-success">{message}</div>}
            <button className="primary full" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : reset ? (
                "Save new password"
              ) : forgot ? (
                "Send a reset link"
              ) : signup ? (
                "Create your account"
              ) : (
                "Sign in to your workspace"
              )}
            </button>
          </form>
          {!reset && !signup && (
            <button
              className="text-button forgot-link"
              onClick={() => {
                setForgot(!forgot);
                setMessage("");
              }}
            >
              {forgot ? "Back to sign in" : "Forgot your password?"}
            </button>
          )}
          {!reset && (
            <>
              <p className="auth-toggle">
                {signup ? "Already part of the team?" : "New around here?"}{" "}
                <button
                  onClick={() => {
                    setSignup(!signup);
                    setForgot(false);
                    setMessage("");
                  }}
                >
                  {signup ? "Sign in" : "Create an account"}
                </button>
              </p>
              <div className="divider">
                <span>or take a look around</span>
              </div>
              <button className="demo-button" onClick={onDemo}>
                <Sparkles size={17} />
                Explore the demo workspace
              </button>
              <small className="auth-fine">
                No sign-up needed. Just good vibes and sample data.
              </small>
            </>
          )}
        </div>
        <div className="auth-bottom">
          <span>
            <Check size={14} />
            Location-verified
          </span>
          <span>
            <Check size={14} />
            People-friendly
          </span>
          <span>
            <Check size={14} />
            Always in sync
          </span>
        </div>
      </section>
    </div>
  );
}
function Onboarding({
  reload,
  notify,
  logout,
}: {
  reload: () => Promise<void>;
  notify: (m: string, e?: boolean) => void;
  logout: () => Promise<void>;
}) {
  const [join, setJoin] = useState(!!new URLSearchParams(location.search).get("invite")),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(
        join ? "/join" : "/onboarding",
        "POST",
        join
          ? { token: f.get("token") }
          : { name: f.get("name"), timezone: f.get("timezone") },
      );
      await reload();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="onboarding">
      <Brand />
      <div className="panel">
        <span className="feature-icon violet">
          <Users />
        </span>
        <h1>{join ? "Find your people." : "Make room for your team."}</h1>
        <p>
          {join
            ? "Paste the invitation code your administrator shared."
            : "Give your new workspace a name. You’ll be its first administrator."}
        </p>
        <form onSubmit={submit}>
          {join ? (
            <label>
              Invitation code
              <input
                name="token"
                defaultValue={new URLSearchParams(location.search).get("invite") || ""}
                required
                placeholder="Your invitation UUID"
              />
            </label>
          ) : (
            <>
              <label>
                Workspace name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. Studio Collective"
                />
              </label>
              <label>
                Workspace timezone
                <select name="timezone" defaultValue="Asia/Kolkata">
                  {[
                    "Asia/Kolkata",
                    "Asia/Dubai",
                    "Asia/Singapore",
                    "Europe/London",
                    "Europe/Paris",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Australia/Sydney",
                    "UTC",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Setting things up…" : join ? "Join your team" : "Create workspace"}
          </button>
        </form>
        <button className="text-button" onClick={() => setJoin(!join)}>
          {join ? "Create a new workspace instead" : "Have an invitation? Join your team"}
        </button>
        <button className="text-button muted" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
