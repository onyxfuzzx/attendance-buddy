# Security

## Reporting

Please do not publish credentials, attendance records, private photos, or detailed exploit instructions in a public issue.

Use **Security → Report a vulnerability** on [this repository](https://github.com/onyxfuzzx/attendance-buddy/security) when private reporting is available. If it is unavailable, open an issue requesting a private reporting channel without including the vulnerability details or sensitive data.

Reports should identify the affected version or commit, the relevant component, the impact, and reproducible steps using synthetic data. The project does not currently promise a response-time SLA or paid bounty.

## Deployment responsibilities

The current default branch is the maintained version. Use your own Supabase project with the provided RLS policies, HTTPS, configured Auth redirects, appropriate backups, and restricted server credentials. Keep the service-role/secret key on the server; the regular application does not require it. The optional test-data loader uses privileged credentials and must not be exposed as a public endpoint.

The GitHub Pages demo stores synthetic data in the visitor's browser. It contains no hosted account credentials or connection to the maintainers' Supabase database.

GPS supplied by a browser can be spoofed. Attendance Buddy verifies reported coordinates and shift rules; it does not provide biometric identity recognition, managed-device attestation, payroll compliance, or a guarantee against device-level tampering.
