import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  locationSchema,
  shiftSchema,
  scanSchema,
  correctionSchema,
  reviewSchema,
  inviteSchema,
  id,
} from "./schemas.js";

type Profile = {
  id: string;
  org_id: string | null;
  role: "admin" | "employee";
  is_active: boolean;
};
declare global {
  namespace Express {
    interface Request {
      db: SupabaseClient;
      profile: Profile;
    }
  }
}
class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function checked<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) {
    const e = error as { message?: string; code?: string };
    if (e.code === "23505")
      throw new ApiError(
        409,
        "This already exists. Withdraw an old invitation or review the existing pending request.",
      );
    const forbidden = e.code === "42501";
    throw new ApiError(forbidden ? 403 : 400, e.message || "Database operation failed");
  }
  return data;
}

export function createApp() {
  const app = express();
  if (process.env.TRUST_PROXY_HOPS) {
    const hops = Number(process.env.TRUST_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 1 || hops > 3)
      throw new Error("TRUST_PROXY_HOPS must be 1, 2, or 3");
    app.set("trust proxy", hops);
  }
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:", "https:"],
                connectSrc: [
                  "'self'",
                  process.env.SUPABASE_URL || "https://*.supabase.co",
                ],
                mediaSrc: ["'self'", "blob:"],
              },
            }
          : false,
    }),
  );
  const origins = (
    process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173"
  ).split(",");
  app.use(cors({ origin: origins }));
  app.use(express.json({ limit: "32kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.get("/api/health", (_req, res) =>
    res.json({
      name: "Attendance Buddy",
      status: "ok",
      configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    }),
  );
  app.use("/api", async (req, res, next) => {
    try {
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY)
        throw new ApiError(
          503,
          "Connect Supabase in backend/.env to use the live workspace.",
        );
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) throw new ApiError(401, "Sign in to continue.");
      req.db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await req.db.auth.getUser(token);
      if (error || !data.user)
        throw new ApiError(401, "Your session expired. Please sign in again.");
      const profile = checked(
        await req.db
          .from("profiles")
          .select("id,org_id,role,is_active")
          .eq("id", data.user.id)
          .single(),
      );
      if (!profile?.is_active)
        throw new ApiError(403, "This account has been deactivated.");
      req.profile = profile;
      next();
    } catch (e) {
      next(e);
    }
  });
  const admin = (req: Request, _res: Response, next: NextFunction) =>
    req.profile.role === "admin" && req.profile.org_id
      ? next()
      : next(new ApiError(403, "Administrator access required."));
  app.get("/api/workspace", async (req, res) => {
    const p = req.profile;
    const results = await Promise.all([
      req.db.from("profiles").select("*").order("full_name"),
      req.db.from("locations").select("*").order("name"),
      req.db.from("shifts").select("*").order("start_time"),
      req.db
        .from("attendance")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(1000),
      req.db
        .from("corrections")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      req.db
        .from("organizations")
        .select("*")
        .eq("id", p.org_id || "00000000-0000-0000-0000-000000000000")
        .maybeSingle(),
      req.db.from("shift_members").select("*"),
      p.role === "admin"
        ? req.db.from("invitations").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      p.role === "admin"
        ? req.db
            .from("audit_log")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const [
      members,
      locations,
      shifts,
      attendance,
      corrections,
      organization,
      assignments,
      invitations,
      audit,
    ] = results.map(checked);
    res.json({
      members,
      locations,
      shifts,
      attendance,
      corrections,
      organization,
      assignments,
      invitations,
      audit,
      profile: p,
    });
  });
  app.post("/api/onboarding", async (req, res) => {
    const { z } = await import("zod");
    const body = z
      .object({
        name: z.string().trim().min(2).max(100),
        timezone: z.string().max(80),
      })
      .parse(req.body);
    checked(
      await req.db.rpc("create_workspace", {
        workspace_name: body.name,
        workspace_timezone: body.timezone,
      }),
    );
    res.status(201).json({ ok: true });
  });
  app.post("/api/join", async (req, res) => {
    const token = id.parse(req.body.token);
    checked(await req.db.rpc("accept_invitation", { invite_token: token }));
    res.json({ ok: true });
  });
  app.post("/api/locations", admin, async (req, res) => {
    res.status(201).json(
      checked(
        await req.db
          .from("locations")
          .insert({
            ...locationSchema.parse(req.body),
            org_id: req.profile.org_id,
          })
          .select()
          .single(),
      ),
    );
  });
  app.patch("/api/locations/:id", admin, async (req, res) => {
    const { z } = await import("zod");
    res.json(
      checked(
        await req.db
          .from("locations")
          .update(z.object({ is_active: z.boolean() }).parse(req.body))
          .eq("id", id.parse(req.params.id))
          .select()
          .single(),
      ),
    );
  });
  app.post("/api/shifts", admin, async (req, res) => {
    const body = shiftSchema.parse(req.body);
    res.status(201).json(checked(await req.db.rpc("create_shift", { payload: body })));
  });
  app.patch("/api/shifts/:id", admin, async (req, res) => {
    const { z } = await import("zod");
    res.json(
      checked(
        await req.db.rpc("set_shift_active", {
          target_shift: id.parse(req.params.id),
          active: z.boolean().parse(req.body.is_active),
        }),
      ),
    );
  });
  app.post("/api/invitations", admin, async (req, res) => {
    res.status(201).json(
      checked(
        await req.db
          .from("invitations")
          .insert({
            ...inviteSchema.parse(req.body),
            org_id: req.profile.org_id,
          })
          .select()
          .single(),
      ),
    );
  });
  app.patch("/api/invitations/:id/revoke", admin, async (req, res) =>
    res.json(
      checked(
        await req.db.rpc("revoke_invitation", {
          target_invitation: id.parse(req.params.id),
        }),
      ),
    ),
  );
  app.patch("/api/members/:id", admin, async (req, res) => {
    const { z } = await import("zod");
    res.json(
      checked(
        await req.db.rpc("set_member_active", {
          member_id: id.parse(req.params.id),
          active: z.boolean().parse(req.body.is_active),
        }),
      ),
    );
  });
  app.post(
    "/api/attendance/scan",
    rateLimit({
      windowMs: 60000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      const body = scanSchema.parse(req.body);
      res
        .status(201)
        .json(checked(await req.db.rpc("mark_attendance", { payload: body })));
    },
  );
  app.post("/api/corrections", async (req, res) => {
    res.status(201).json(
      checked(
        await req.db
          .from("corrections")
          .insert({
            ...correctionSchema.parse(req.body),
            user_id: req.profile.id,
            org_id: req.profile.org_id,
          })
          .select()
          .single(),
      ),
    );
  });
  app.patch("/api/corrections/:id", admin, async (req, res) => {
    const body = reviewSchema.parse(req.body);
    res.json(
      checked(
        await req.db.rpc("review_correction", {
          request_id: id.parse(req.params.id),
          decision: body.status,
          note: body.review_note,
        }),
      ),
    );
  });
  app.patch("/api/profile", async (req, res) => {
    const { z } = await import("zod");
    const body = z
      .object({
        full_name: z.string().trim().min(2).max(100),
        department: z.string().trim().max(60),
      })
      .parse(req.body);
    res.json(
      checked(
        await req.db.rpc("update_profile", {
          profile_name: body.full_name,
          profile_department: body.department,
        }),
      ),
    );
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Endpoint not found." }));
  if (process.env.NODE_ENV === "production") {
    const directory = fileURLToPath(new URL("../../frontend/dist", import.meta.url));
    app.use(express.static(directory));
    app.get("/{*path}", (_req, res) => res.sendFile(path.join(directory, "index.html")));
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
      return;
    }
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON request." });
      return;
    }
    console.error(
      "Request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });
  return app;
}
