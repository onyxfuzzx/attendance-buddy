import { createApp } from "./app.js";
const port = Number(process.env.PORT || 3001);
const host =
  process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const server = createApp().listen(port, host, () =>
  console.log(`Attendance Buddy API: http://${host}:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
