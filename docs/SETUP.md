# Setup and deployment

**Your team, in sync.** A React and TypeScript attendance workspace for teams of every kind, with an Express API and Supabase Auth, PostgreSQL, and private Storage.

Run all commands from the repository root. The project website and public demo are deployed separately from the authenticated application.

## Run it

Requires Node.js 22.12+ (Node 24 recommended) and npm.

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:5173** and select **Explore the demo workspace**. The API runs at **http://127.0.0.1:3001**; `/api/health` is public.

Demo mode works without credentials. It uses sample people, attendance, and shifts, and saves edits in this browser's local storage. Location and shift verification are simulated in demo mode; live records are verified in PostgreSQL. Reset the sample data in Settings. Signing out exits the demo.

## Connect Supabase

1. Create a fresh Supabase project. In its SQL editor, run `supabase/migrations/202611250001_attendance_buddy.sql` once. It creates the schema, authorization policies, transactional functions, audit triggers, and private `attendance-photos` storage bucket.
2. Copy the environment examples:

   ```powershell
   Copy-Item frontend/.env.example frontend/.env
   Copy-Item backend/.env.example backend/.env
   ```

3. Set the same Supabase project URL and **publishable/anon key** in both files. The frontend variables start with `VITE_`. **A service-role key is not needed and must never be placed in the frontend.** The API forwards each verified user's JWT to Supabase so database authorization stays active.
4. In Supabase Authentication, enable email/password sign-in. Set the Site URL to `http://127.0.0.1:5173` for local development and allow that URL, including invitation query parameters, as a redirect URL. Configure your production HTTPS origin before deployment. Keep email confirmation enabled and configure SMTP for reliable confirmation and password-reset delivery.
5. Restart `npm run dev`, sign out of demo if necessary, and create your account. Confirm the email, then create your workspace. The creator becomes its administrator. The timezone controls attendance dates, shift rules, and reporting.
6. Add a workplace with its real coordinates. Create a shift, pick its days and assign teammates. Invite teammates from Team, then copy and share each invitation link. Invitations **do not send email** automatically; they expire after seven days and are tied to the invited email address. Withdraw an expired invitation before issuing another to the same person.
7. Teammates sign up using their invited email, confirm it, and join with the invitation code. Display the workplace QR at the entrance. Employees scan or paste the workplace code, verify GPS, optionally capture a photo, and confirm check-in or check-out.

The initial migration is intended for a new Supabase project. It does not import historical data from other attendance systems.

## Load test data into Supabase

After the migration is applied, add `SUPABASE_SERVICE_ROLE_KEY` to `backend/.env` using a server-only Supabase secret/service-role key. This key is used only by the seed command; the application continues to use the public key and each user's session.

```powershell
npm run seed:test
```

The seed creates an isolated **Attendance Buddy Test Lab** workspace with 8 confirmed test accounts (2 admins, 5 active employees, and 1 inactive employee), 3 workplaces, 5 shifts including overnight and paused schedules, approximately 3 weeks of attendance, pending/approved/rejected corrections, invitations, and audit events. The Admin API confirms these test accounts without sending email.

Random test passwords are saved in **`backend/.seed-accounts.json`**, which is excluded from Git and Docker. Use Alex's account for the admin view or Priya's for the employee view. Sign out of the browser demo before signing in. An inactive test account intentionally cannot enter the workspace.

Reruns reuse seed identities and the original sample dates, inserting only missing fixture rows; they do not reset passwords or overwrite existing rows. Existing workspaces and non-fixture users are left alone. These records are labeled test data and use sample coordinates. For a real GPS check-in, create a workplace at your actual location and assign a matching current shift.

## The flow

- **Overview:** today's check-ins, late arrivals, a seven-day chart, active shifts, and recent attendance.
- **Attendance:** date, person, status, and workplace filters; pagination; CSV export of the filtered records; private photo access; and correction requests for your own records.
- **Team:** email-bound invitations, withdrawal, and reversible deactivation. Administrator accounts cannot be deactivated through the employee endpoint.
- **Locations:** GPS coordinates, a boundary radius of 20 to 2,000 meters, printable SVG QR, and pause/resume.
- **Shifts:** recurring weekday schedules, bulk member assignment, overnight shifts, and pause/resume. Schedules are immutable: pause an old shift and create its replacement to preserve historical shift rules. Open check-ins may still check out against their original paused shift.
- **Requests:** pending/approved/rejected views, review notes, and transactional approval. Approval updates the record while retaining the original time and audit details. An administrator cannot approve their own request.
- **Reports:** completed work hours, person-days, late check-ins, on-time percentages, summary CSV, and an administrator-only audit trail.
- **Settings:** profile updates, password changes, workspace details, and demo reset. Sign-in also supports password recovery.

The employee view contains only the employee's own profile, attendance, corrections and shift assignments. Administrator-only navigation is hidden. The API and database enforce permissions independently of the interface.

## Attendance rules

- The browser supplies the workplace token, coordinates, accuracy, and intended action. The database supplies identity, workspace, timestamp, shift, distance, and resulting status.
- A signed-in, active member must be assigned to an active shift at the active workplace. Check-in opens two hours before a shift and closes at shift end.
- PostgreSQL calculates Haversine distance. The location must fall inside the configured radius, with reported GPS accuracy of 100m or better.
- Check-ins receive 15 minutes of grace. Later arrivals are marked late. Check-outs before shift end are marked early.
- Attendance actions alternate in/out; check-out must use the original workplace. A member row lock serializes writes, and a 30-second cooldown blocks rapid repeats.
- Overnight schedules retain the starting weekday and wrap the end time onto the next local date.
- Corrections must refer to your own record, be within the past 60 days, stay on the original local date, and preserve the surrounding attendance sequence. Only one pending correction per record is permitted. Approval and record modification happen in one database transaction.
- Photos are optional JPEG/PNG/WebP files up to 2MB in a private bucket. Storage policies restrict paths and visibility; viewing uses a 60-second signed URL. Photos are evidence capture, not face recognition. GPS is recorded at attendance actions only, with no background tracking.

Browser coordinates can be spoofed on a controlled device. QR + GPS is a presence check, not a guarantee against device-level tampering. Higher assurance would require managed devices or additional trusted hardware.

## Architecture and source

```text
frontend/                 React 19 + TypeScript + Vite; responsive custom CSS
  src/App.tsx             Authentication, app shell, navigation and demo persistence
  src/pages.tsx           Overview, attendance, team, shifts, locations, requests, reports, settings
  src/forms.tsx           Validated dialogs, invitations, QR generation, private photo viewing
  src/scanner.tsx         QR camera, GPS, optional photo and attendance flow
  src/lib.ts              API client, Supabase client, date/export helpers and demo fixtures
backend/                  Node.js + Express 5 + TypeScript + Zod
  src/app.ts              Verified authentication, role checks, validation, rate limits and routes
  test/                   API and embedded PostgreSQL integration tests
supabase/migrations/      Schema, RLS, storage policies, transactional RPCs and audit triggers
tests/                    Playwright browser regression tests
.github/workflows/ci.yml   Build, backend tests and Chromium UI tests
Dockerfile                Multi-stage production image
```

The app uses React, Express/TypeScript, and Supabase. Fonts are served locally. The QR decoding library loads only when the camera scanner is opened.

### API

All endpoints except health require a Supabase bearer token. Administrative writes also require the current database profile to be an active administrator. Input schemas reject invalid IDs, coordinates, times, and request fields.

| Method       | Path                                   | Purpose                                 |
| ------------ | -------------------------------------- | --------------------------------------- |
| GET          | `/api/health`                          | Process status and configuration flag   |
| GET          | `/api/workspace`                       | Role-scoped workspace data              |
| POST         | `/api/onboarding`                      | Create your first workspace             |
| POST         | `/api/join`                            | Accept an email-bound invitation        |
| POST / PATCH | `/api/locations`, `/api/locations/:id` | Create / pause or activate workplace    |
| POST / PATCH | `/api/shifts`, `/api/shifts/:id`       | Create assigned shift / pause or resume |
| POST         | `/api/invitations`                     | Create invitation                       |
| PATCH        | `/api/invitations/:id/revoke`          | Withdraw invitation                     |
| PATCH        | `/api/members/:id`                     | Deactivate/reactivate employee          |
| POST         | `/api/attendance/scan`                 | Atomic, verified attendance action      |
| POST         | `/api/corrections`                     | Submit correction                       |
| PATCH        | `/api/corrections/:id`                 | Review and optionally apply correction  |
| PATCH        | `/api/profile`                         | Update permitted profile fields         |

Reads are protected by row-level security. Attendance, membership, shift, and review writes use narrowly scoped database functions with explicit identity/role checks and empty search paths. Anonymous access is revoked. Protected table updates and audit edits are not granted to application users. No service-role bypass is used. Security headers, allowed CORS origins, request-size limits and API rate limiting are configured in Express.

The workspace currently loads the latest **1,000 attendance records**, **200 correction requests** and **100 audit events**. Reports and exports operate on that loaded attendance window, which is labeled in the interface. For a large organization, add server-side paginated reporting or scheduled aggregates before relying on long-period reports. Weekly attendance uses current active assignments as its denominator; assignment history and leave calendars are not modeled. This app does not calculate payroll or leave balances.

## Verification

```powershell
npm run build
npm test
npm run test:ui
npm run supabase:check
```

UI tests use locally installed Google Chrome by default. If Chrome is unavailable, run `npx playwright install chromium` and use `CI=true` so the configuration selects bundled Chromium. CI installs Chromium automatically.

The backend suite executes the migration and functions in **PGlite (embedded PostgreSQL)** with stubbed Supabase `auth` and `storage` schemas. It checks tenant isolation, privilege escalation, invitation ownership, invalid GPS, geofence rejection, shift assignment, duplicate scans, correction approval, overnight checkout and suspension. API tests verify health, closed-by-default configuration, anonymous denial, and input schemas.

Browser tests exercise the demo workspace: navigation, QR rendering, record filters, workplace/shift creation, invitations, persistence, corrections, CSV download, check-out, modal keyboard behavior, and mobile layout.

These tests do not substitute for a connected Supabase acceptance run. Auth email delivery, actual Storage uploads, real camera scanning/GPS on mobile, and Docker deployment must be checked against your configured project and environment.

## Production

For a single service, build the frontend and API, then let Express serve both:

```powershell
npm ci
npm run build
$env:NODE_ENV = 'production'
npm start
```

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FRONTEND_ORIGIN`, and optionally `PORT` and `HOST` in the process environment. The frontend's `VITE_` variables are embedded at **build time**, so configure `frontend/.env` or build environment before building. Do not embed private keys.

The server listens on `0.0.0.0` in production. Terminate TLS at your hosting platform or reverse proxy. Set `TRUST_PROXY_HOPS` to the exact number of trusted proxies only if your hosting topology requires it. Use one API instance for the in-memory rate limiter, or replace it with a shared store for multiple instances. Health checks do not validate remote Supabase availability.

Alternatively, build the included Docker image:

```powershell
docker build --build-arg VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co --build-arg VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY -t attendance-buddy .
docker run --env-file backend/.env -e NODE_ENV=production -p 3001:3001 attendance-buddy
```

Use HTTPS for production camera/GPS access. Update Supabase Site URL and allowed redirect URLs to your production origin. Confirm sign-up, invite acceptance, in/out, correction review, and private photo access with an admin and an employee from two separate workspaces before going live.
