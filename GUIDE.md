# Attendance Buddy: first-day guide

The primary app is now **React + Express/TypeScript + Supabase**. See [README.md](README.md) for installation, configuration, API details, testing, and deployment.

1. Run `npm ci`, then `npm run dev` at the repository root.
2. Open http://127.0.0.1:5173 and explore the demo workspace.
3. To use real data, create a Supabase project, run the included SQL migration, and fill the frontend/backend environment files.
4. Create and confirm your account, then name your workspace and choose its timezone.
5. Add a workplace using real coordinates. Set the allowed check-in radius.
6. Create a shift and assign members. Pause outdated shifts instead of altering historical schedules.
7. Create invitations in Team and share their links with the intended people. Invites are bound to their email addresses.
8. Display the workplace QR. Employees scan it, verify GPS, optionally capture a photo, and confirm attendance.
9. Review corrections in Requests. Approved changes preserve the original timestamp and an audit trail.
10. Use Attendance and Reports to filter and export your records. Reports show the loaded attendance window, with a maximum of the latest 1,000 records.

The original Angular/.NET folders, old PDFs, and `sql/setup.sql` remain for historical reference. They are not used by the root build or the new app. No historical SQL Server data is imported automatically.
