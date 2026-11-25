import { useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import {
  ScanLine,
  MapPin,
  Check,
  Camera,
  LocateFixed,
  ShieldCheck,
  Clock3,
  LoaderCircle,
  ChevronRight,
  X,
} from "lucide-react";
import { useBuddy } from "./context";
import { Badge } from "./components";
import { supabase, time, uid } from "./lib";
export function Scanner() {
  const { data, demo, mutate, notify, setPage } = useBuddy();
  const [step, setStep] = useState(1),
    [token, setToken] = useState(""),
    [position, setPosition] = useState<GeolocationCoordinates | null>(null),
    [busy, setBusy] = useState(false),
    [camera, setCamera] = useState(false),
    [photo, setPhoto] = useState<Blob | null>(null),
    [photoUrl, setPhotoUrl] = useState(""),
    [scanning, setScanning] = useState(false),
    [success, setSuccess] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const qr = useRef<Html5Qrcode | null>(null);
  const previous = data.attendance.find((a) => a.user_id === data.profile.id);
  const [action] = useState<"in" | "out">(() =>
    previous?.action === "in" ? "out" : "in",
  );
  const location = data.locations.find((l) => l.token === token && l.is_active);
  const me = data.members.find((m) => m.id === data.profile.id)!;
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (qr.current?.isScanning) void qr.current.stop().catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  async function startQr() {
    setScanning(true);
    setTimeout(async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const scanner = new Html5Qrcode("qr-reader");
        qr.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (text) => {
            try {
              const parsed = JSON.parse(text);
              if (parsed.app !== "attendance-buddy" || !parsed.token)
                throw new Error("Invalid QR");
              setToken(parsed.token);
              await scanner.stop();
              setScanning(false);
              notify("Workplace QR scanned.");
            } catch {
              notify("That is not an Attendance Buddy QR.", true);
            }
          },
          () => {},
        );
      } catch (e) {
        setScanning(false);
        notify(
          "Camera unavailable. Allow camera access or paste your workplace code.",
          true,
        );
      }
    }, 50);
  }
  async function stopQr() {
    if (qr.current?.isScanning) await qr.current.stop();
    setScanning(false);
  }
  function locate() {
    if (demo) {
      setPosition({
        latitude: location?.latitude || 12.9784,
        longitude: location?.longitude || 77.6408,
        accuracy: 8,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: () => ({}),
      });
      notify("Demo location verified (simulated).");
      return;
    }
    if (!navigator.geolocation) {
      notify("Location isn’t supported by this browser.", true);
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        if (p.coords.accuracy > 100) {
          notify(
            `GPS accuracy is ${Math.round(p.coords.accuracy)}m. Move near a window or outdoors and try again.`,
            true,
          );
          return;
        }
        setPosition(p.coords);
      },
      (e) => {
        setBusy(false);
        notify(
          e.code === 1
            ? "Allow location access in your browser to verify your workplace."
            : "GPS timed out. Move outdoors and try again.",
          true,
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }
  async function startCamera() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      setCamera(true);
      setTimeout(() => {
        if (video.current) {
          video.current.srcObject = stream.current;
          void video.current.play();
        }
      }, 50);
    } catch {
      notify(
        "Camera access unavailable. You can continue without an optional photo.",
        true,
      );
    }
  }
  function capture() {
    const v = video.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhoto(blob);
          setCamera(false);
          stream.current?.getTracks().forEach((t) => t.stop());
        }
      },
      "image/jpeg",
      0.8,
    );
  }
  async function submit() {
    if (!position) return;
    setBusy(true);
    try {
      let photo_path: string | undefined;
      if (photo && !demo) {
        photo_path = `${data.profile.id}/${uid()}.jpg`;
        const { error } = await supabase!.storage
          .from("attendance-photos")
          .upload(photo_path, photo, {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (error) throw error;
      }
      await mutate("/attendance/scan", "POST", {
        token,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        action,
        photo_path,
      });
      setSuccess(true);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="checkin-success panel">
        <span className="success-orbit">
          <Check size={42} />
        </span>
        <span className="eyebrow">ONE LITTLE CHECK. ONE GREAT DAY.</span>
        <h1>
          You’re all {action === "in" ? "checked in" : "checked out"},{" "}
          {me.full_name.split(" ")[0]}.
        </h1>
        <p>
          {action === "in"
            ? "Here’s to good work and great company."
            : "Good work today. Time for a little you-time."}
        </p>
        <div className="checkin-receipt">
          <MapPin size={18} />
          <strong>{location?.name}</strong>
          <span>{time(new Date().toISOString(), data.organization!.timezone)}</span>
          <Badge>{demo ? "Demo check-in" : "Location verified"}</Badge>
        </div>
        <button className="primary" onClick={() => setPage("Attendance")}>
          See my attendance <ChevronRight size={16} />
        </button>
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ONE LESS THING TO THINK ABOUT</span>
          <h1>A little check. A great start.</h1>
          <p>
            {previous?.action === "in"
              ? "Ready to wrap up? Let’s record your check-out."
              : "Let’s get you checked in and on with your day."}
          </p>
        </div>
        <Badge tone="violet">Checking {action === "in" ? "in" : "out"}</Badge>
      </div>
      <div className="scanner-layout">
        <section className="panel scanner-panel">
          <div className="checkin-steps">
            {["Your workplace", "Your location", "You’re ready"].map((label, i) => (
              <div key={label} className={step >= i + 1 ? "current" : ""}>
                <span>{step > i + 1 ? <Check size={16} /> : i + 1}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
          {step === 1 ? (
            <div className="scanner-step">
              <span className="scanner-illustration">
                <ScanLine size={64} />
              </span>
              <h2>Say hello to your workplace.</h2>
              <p>Scan the QR at your workplace, or paste its code below.</p>
              {scanning && <div id="qr-reader" />}
              <div className="scan-buttons">
                <button className="primary" disabled={scanning} onClick={startQr}>
                  <Camera size={17} />
                  Scan workplace QR
                </button>
                {scanning && (
                  <button className="secondary" onClick={() => void stopQr()}>
                    <X size={15} />
                    Stop camera
                  </button>
                )}
              </div>
              <div className="divider">
                <span>or use your workplace code</span>
              </div>
              {demo && (
                <label>
                  Demo workplace
                  <select value={token} onChange={(e) => setToken(e.target.value)}>
                    <option value="">Choose a demo workplace</option>
                    {data.locations
                      .filter((l) => l.is_active)
                      .map((l) => (
                        <option key={l.id} value={l.token}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Workplace code
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  placeholder="Paste your workplace UUID code"
                />
              </label>
              {token && location && (
                <div className="inline-success">
                  <Check size={15} />
                  {location.name} · {location.address}
                </div>
              )}
              {token && !location && (
                <p className="inline-error">
                  This code doesn’t match an active workplace in your team.
                </p>
              )}
              <button
                className="primary full"
                disabled={!location || scanning}
                onClick={() => setStep(2)}
              >
                That’s my workplace <ChevronRight size={16} />
              </button>
            </div>
          ) : step === 2 ? (
            <div className="scanner-step">
              <span className="scanner-illustration">
                <LocateFixed size={64} />
              </span>
              <h2>Right place. Right you.</h2>
              <p>
                Verify that you’re within {location?.radius}m of {location?.name}. Your
                coordinates are checked securely on the server.
              </p>
              <button className="primary" onClick={locate} disabled={busy}>
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <LocateFixed size={17} />
                )}{" "}
                {busy
                  ? "Finding your location…"
                  : position
                    ? "Refresh location"
                    : "Verify my location"}
              </button>
              {position && (
                <div className="gps-result">
                  <Check size={20} />
                  <div>
                    <strong>
                      {demo ? "Demo coordinates ready" : "GPS coordinates captured"}
                    </strong>
                    <small>
                      Accuracy: {Math.round(position.accuracy)}m ·{" "}
                      {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
                    </small>
                  </div>
                </div>
              )}
              <div className="step-footer">
                <button className="secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  className="primary"
                  disabled={!position || busy}
                  onClick={() => setStep(3)}
                >
                  Continue <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="scanner-step">
              <span className="eyebrow">THE LAST LITTLE STEP</span>
              <h2>All set for your check-{action}.</h2>
              <p>
                A photo is optional. Your GPS location and assigned shift are verified
                when you submit.
              </p>
              {photo ? (
                <div className="photo-preview">
                  <img src={photoUrl} alt="Your attendance photo" />
                  <button className="secondary" onClick={() => setPhoto(null)}>
                    Retake photo
                  </button>
                </div>
              ) : camera ? (
                <div className="photo-preview">
                  <video ref={video} playsInline muted />
                  <button className="primary" onClick={capture}>
                    <Camera size={16} />
                    Take photo
                  </button>
                </div>
              ) : (
                <button className="photo-placeholder" onClick={startCamera}>
                  <Camera size={28} />
                  <strong>Add a quick photo</strong>
                  <span>Optional · Only you and your admin can view it</span>
                </button>
              )}
              <div className="scan-summary">
                <span>
                  <MapPin size={17} />
                  {location?.name}
                </span>
                <span>
                  <ShieldCheck size={17} />
                  GPS accuracy: {position?.accuracy.toFixed(0)}m
                </span>
              </div>
              {demo && (
                <p className="demo-form-note">
                  Demo check-ins simulate GPS and shift verification. Live mode validates
                  both in PostgreSQL.
                </p>
              )}
              <div className="step-footer">
                <button
                  className="secondary"
                  onClick={() => {
                    stream.current?.getTracks().forEach((t) => t.stop());
                    setCamera(false);
                    setStep(2);
                  }}
                >
                  Back
                </button>
                <button className="primary" disabled={busy} onClick={() => void submit()}>
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <Check size={17} />
                  )}{" "}
                  {busy ? "Recording…" : `Confirm check-${action}`}
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="checkin-aside">
          <span className="feature-icon violet">
            <ShieldCheck />
          </span>
          <h3>A check-in you can trust.</h3>
          <p>Made simple for you. Kept secure for your team.</p>
          <div>
            <ScanLine size={19} />
            <span>
              <strong>Your workplace QR</strong>
              <small>Connects your check-in to the right place.</small>
            </span>
          </div>
          <div>
            <MapPin size={19} />
            <span>
              <strong>Real location verification</strong>
              <small>GPS confirms you’re within your workplace boundary.</small>
            </span>
          </div>
          <div>
            <Clock3 size={19} />
            <span>
              <strong>Your time, recorded fairly</strong>
              <small>
                A 15-minute grace period gives your morning a little breathing room.
              </small>
            </span>
          </div>
          <p className="checkin-privacy">
            Your location is captured only when you check in or out. There’s no background
            tracking.
          </p>
        </aside>
      </div>
    </>
  );
}
