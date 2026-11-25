import { useState, useRef, useEffect, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  MapPin,
  LocateFixed,
  Plus,
  Copy,
  Download,
  Check,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { Modal, Avatar, Badge } from "./components";
import { useBuddy } from "./context";
import { time, supabase } from "./lib";

export function Forms({
  kind,
  id,
  onClose,
}: {
  kind: string;
  id?: string;
  onClose: () => void;
}) {
  const { data, mutate, notify, demo } = useBuddy();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [coordinates, setCoordinates] = useState({
    latitude: "",
    longitude: "",
  });
  const [gpsBusy, setGpsBusy] = useState(false);
  const [decision, setDecision] = useState("approved");
  const [invitation, setInvitation] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const loc = data.locations.find((l) => l.id === id);
  const request = data.corrections.find((c) => c.id === id);
  const own = data.attendance.filter((a) => a.user_id === data.profile.id);
  const [attendanceId, setAttendanceId] = useState(id || own[0]?.id || "");
  const record = data.attendance.find((a) => a.id === attendanceId);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");
  useEffect(() => {
    if (kind !== "photo" || !record?.photo_path || !supabase) return;
    let active = true;
    supabase.storage
      .from("attendance-photos")
      .createSignedUrl(record.photo_path, 60)
      .then(({ data, error }) => {
        if (active) {
          if (error) setPhotoError("This photo could not be loaded. Please try again.");
          else setPhotoUrl(data.signedUrl);
        }
      });
    return () => {
      active = false;
    };
  }, [kind, record?.photo_path]);
  const title =
    kind === "photo"
      ? "Your attendance photo"
      : kind === "location"
        ? "A new place to do great things"
        : kind === "shift"
          ? "Find a good rhythm"
          : kind === "invite"
            ? "There’s always room for good people"
            : kind === "review"
              ? "A little context makes it clear"
              : kind === "qr"
                ? "Your workplace check-in"
                : "Let’s get your time right";
  const subtitle =
    kind === "photo"
      ? "A private snapshot, visible to you and your workspace admin."
      : kind === "location"
        ? "Set a real-world boundary for verified check-ins."
        : kind === "shift"
          ? "Choose the place, the time, and the people."
          : kind === "invite"
            ? "Create a personal invitation and share the link."
            : kind === "review"
              ? "Review the details before making your decision."
              : kind === "qr"
                ? "Display this QR where your team arrives."
                : "Pick a record and tell your admin what needs changing.";
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (kind === "location")
        await mutate("/locations", "POST", {
          name: f.get("name"),
          address: f.get("address"),
          latitude: Number(coordinates.latitude),
          longitude: Number(coordinates.longitude),
          radius: Number(f.get("radius")),
        });
      if (kind === "shift") {
        if (!days.length) throw new Error("Choose at least one day.");
        if (!selected.length) throw new Error("Assign at least one teammate.");
        if (f.get("start_time") === f.get("end_time"))
          throw new Error("Start and end times must differ.");
        await mutate("/shifts", "POST", {
          name: f.get("name"),
          location_id: f.get("location_id"),
          start_time: f.get("start_time"),
          end_time: f.get("end_time"),
          days,
          member_ids: selected,
        });
      }
      if (kind === "invite") {
        await mutate("/invitations", "POST", {
          full_name: f.get("full_name"),
          email: f.get("email"),
          department: f.get("department"),
        });
        setInvitation(String(f.get("email")));
        notify("Invitation created. Copy the link from your team page.");
        return;
      }
      if (kind === "request") {
        const date = new Date(String(f.get("requested_time")));
        if (+date > Date.now())
          throw new Error("The corrected time must be in the past.");
        if (Date.now() - +date > 60 * 86400000)
          throw new Error("Corrections are available for the last 60 days.");
        await mutate("/corrections", "POST", {
          attendance_id: f.get("attendance_id"),
          requested_time: date.toISOString(),
          reason: f.get("reason"),
        });
      }
      if (kind === "review")
        await mutate(`/corrections/${id}`, "PATCH", {
          status: decision,
          review_note: f.get("review_note"),
        });
      notify(
        kind === "location"
          ? "New workplace, ready for good work."
          : kind === "shift"
            ? "Your team’s new rhythm is ready."
            : kind === "request"
              ? "Correction sent. Your admin will take a look."
              : "Request reviewed.",
      );
      onClose();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  function getGps() {
    if (!navigator.geolocation) {
      notify("This browser does not support geolocation.", true);
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoordinates({
          latitude: p.coords.latitude.toFixed(6),
          longitude: p.coords.longitude.toFixed(6),
        });
        setGpsBusy(false);
      },
      (e) => {
        notify(
          e.code === 1
            ? "Allow location access to use your current position."
            : "Couldn’t find your location. Enter coordinates manually.",
          true,
        );
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  function downloadQr() {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-buddy-${loc?.name.replace(/[^a-z0-9]/gi, "-")}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose}>
      {kind === "photo" ? (
        <div className="photo-dialog">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Private photo captured at this attendance check-in"
            />
          ) : photoError ? (
            <p>{photoError}</p>
          ) : (
            <LoaderCircle className="spin" />
          )}
          <small>
            Photo access expires after 60 seconds. Close and reopen to refresh.
          </small>
        </div>
      ) : kind === "qr" && loc ? (
        <div className="qr-dialog">
          <div className="qr-image" ref={qrRef}>
            <QRCodeSVG
              value={JSON.stringify({
                app: "attendance-buddy",
                token: loc.token,
              })}
              size={224}
              level="M"
              marginSize={3}
            />
          </div>
          <h3>{loc.name}</h3>
          <p>{loc.address}</p>
          <Badge tone="teal">Within {loc.radius}m · Location verified</Badge>
          <div className="qr-actions">
            <button className="primary" onClick={downloadQr}>
              <Download size={16} />
              Download QR
            </button>
            <button
              className="secondary"
              onClick={() =>
                navigator.clipboard
                  .writeText(loc.token)
                  .then(() => notify("Workplace code copied."))
                  .catch(() =>
                    notify(
                      "Clipboard unavailable. Select the code below to copy it.",
                      true,
                    ),
                  )
              }
            >
              <Copy size={16} />
              Copy code
            </button>
          </div>
          <code className="qr-token">{loc.token}</code>
          <small>
            QR codes identify a workplace. Each check-in also requires a signed-in
            account, an assigned shift, and GPS verification.
          </small>
        </div>
      ) : invitation ? (
        <div className="dialog-body">
          <span className="feature-icon green">
            <Check />
          </span>
          <h3>A place for {invitation}</h3>
          <p>
            Your invitation is ready. Share its link from the Team page. This app creates
            invitation links; it doesn’t send email automatically.
          </p>
          <button className="primary" onClick={onClose}>
            Got it
          </button>
        </div>
      ) : (
        <form className="dialog-form" onSubmit={submit}>
          {kind === "location" && (
            <>
              <label>
                Workplace name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. The Studio · HQ"
                />
              </label>
              <label>
                Address
                <input
                  name="address"
                  required
                  minLength={3}
                  maxLength={240}
                  placeholder="e.g. Indiranagar, Bengaluru"
                />
              </label>
              <div className="form-section-label">
                <span>
                  <MapPin size={15} />
                  GPS coordinates
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={getGps}
                  disabled={gpsBusy}
                >
                  <LocateFixed size={14} />
                  {gpsBusy ? "Finding you…" : "Use my location"}
                </button>
              </div>
              <div className="form-row">
                <label>
                  Latitude
                  <input
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={coordinates.latitude}
                    onChange={(e) =>
                      setCoordinates({
                        ...coordinates,
                        latitude: e.target.value,
                      })
                    }
                    placeholder="12.9784"
                    required
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={coordinates.longitude}
                    onChange={(e) =>
                      setCoordinates({
                        ...coordinates,
                        longitude: e.target.value,
                      })
                    }
                    placeholder="77.6408"
                    required
                  />
                </label>
              </div>
              <label>
                Check-in radius (meters)
                <input
                  type="number"
                  name="radius"
                  min={20}
                  max={2000}
                  defaultValue={150}
                  required
                />
                <small>
                  Team members must be inside this boundary. Choose a radius from 20 to 2,000 meters.
                </small>
              </label>
            </>
          )}
          {kind === "invite" && (
            <>
              <label>
                Full name
                <input
                  name="full_name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. Priya Sharma"
                />
              </label>
              <label>
                Work email
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="priya@yourteam.com"
                />
              </label>
              <label>
                Department
                <input
                  name="department"
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="e.g. Design"
                />
              </label>
              <div className="info-note">
                <ShieldCheck size={18} />
                <p>
                  Invitations grant team member access, expire in 7 days, and are tied to
                  this email address.
                </p>
              </div>
            </>
          )}
          {kind === "shift" && (
            <>
              <label>
                Shift name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. The everyday shift"
                />
              </label>
              <label>
                Workplace
                <select name="location_id" required defaultValue="">
                  <option value="" disabled>
                    Choose a workplace
                  </option>
                  {data.locations
                    .filter((l) => l.is_active)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </label>
              {!data.locations.some((l) => l.is_active) && (
                <p className="inline-error">
                  Add an active workplace before creating a shift.
                </p>
              )}
              <div className="form-row">
                <label>
                  Start time
                  <input type="time" name="start_time" defaultValue="09:00" required />
                </label>
                <label>
                  End time
                  <input type="time" name="end_time" defaultValue="18:00" required />
                </label>
              </div>
              <small>
                Times use {data.organization!.timezone}. An end time before the start
                means an overnight shift.
              </small>
              <label>Repeats on</label>
              <div className="weekdays interactive">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <button
                    type="button"
                    key={d}
                    aria-pressed={days.includes(i)}
                    onClick={() =>
                      setDays(
                        days.includes(i) ? days.filter((day) => day !== i) : [...days, i],
                      )
                    }
                    className={days.includes(i) ? "scheduled" : ""}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <div className="form-section-label">
                <span>Who’s on this shift?</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    setSelected(
                      selected.length
                        ? []
                        : data.members.filter((m) => m.is_active).map((m) => m.id),
                    )
                  }
                >
                  {selected.length ? "Clear selection" : "Select all"}
                </button>
              </div>
              <div className="member-picker">
                {data.members
                  .filter((m) => m.is_active)
                  .map((m, i) => (
                    <label key={m.id}>
                      <input
                        type="checkbox"
                        checked={selected.includes(m.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, m.id]
                              : selected.filter((id) => id !== m.id),
                          )
                        }
                      />
                      <Avatar name={m.full_name} index={i} small />
                      <span>
                        {m.full_name}
                        <small>{m.department}</small>
                      </span>
                    </label>
                  ))}
              </div>
            </>
          )}
          {kind === "request" && (
            <>
              <label>
                Attendance record
                <select
                  name="attendance_id"
                  value={attendanceId}
                  onChange={(e) => setAttendanceId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Choose one of your records
                  </option>
                  {own.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.occurred_at).toLocaleDateString("en-IN", {
                        timeZone: data.organization!.timezone,
                      })}{" "}
                      · {time(a.occurred_at, data.organization!.timezone)} · Check-
                      {a.action}
                    </option>
                  ))}
                </select>
              </label>
              {!own.length && (
                <p className="inline-error">
                  You’ll need an attendance record before submitting a correction.
                </p>
              )}
              <label>
                Correct date & time
                <input
                  type="datetime-local"
                  name="requested_time"
                  key={attendanceId}
                  defaultValue={
                    record
                      ? new Date(
                          +new Date(record.occurred_at) -
                            new Date(record.occurred_at).getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  required
                />
                <small>
                  Enter the time in your device’s timezone (
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}). Keep it on the
                  record’s original local date.
                </small>
              </label>
              <label>
                What happened?
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  placeholder="A little context helps your admin get this right…"
                />
              </label>
            </>
          )}
          {kind === "review" && request && (
            <>
              <div className="review-context">
                <strong>
                  {data.members.find((m) => m.id === request.user_id)?.full_name}
                </strong>
                <p>{request.reason}</p>
                <span>
                  Requested:{" "}
                  {new Date(request.requested_time).toLocaleString("en-IN", {
                    timeZone: data.organization!.timezone,
                  })}
                </span>
              </div>
              <label>
                Your decision
                <select value={decision} onChange={(e) => setDecision(e.target.value)}>
                  <option value="approved">Approve and update attendance</option>
                  <option value="rejected">Decline this correction</option>
                </select>
              </label>
              <label>
                A note for your teammate
                <textarea
                  name="review_note"
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  required
                  placeholder="Share a little context for your decision…"
                />
              </label>
              <div className="info-note">
                <ShieldCheck size={17} />
                <p>
                  Approved corrections update the attendance time and preserve the
                  original in the audit history.
                </p>
              </div>
            </>
          )}
          {demo && (
            <small className="demo-form-note">
              Demo mode · This change is saved only on this device.
            </small>
          )}
          <div className="modal-footer">
            <button className="secondary" type="button" onClick={onClose}>
              Maybe later
            </button>
            <button
              className="primary"
              type="submit"
              disabled={
                busy ||
                (kind === "request" && !own.length) ||
                (kind === "shift" && !data.locations.some((l) => l.is_active))
              }
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : kind === "location" ? (
                <Plus size={16} />
              ) : (
                <Check size={16} />
              )}
              {busy
                ? "Saving…"
                : kind === "location"
                  ? "Add workplace"
                  : kind === "invite"
                    ? "Create invitation"
                    : kind === "shift"
                      ? "Create shift"
                      : kind === "request"
                        ? "Send for review"
                        : "Save decision"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
