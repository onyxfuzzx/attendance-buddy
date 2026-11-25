import { z } from "zod";
export const id = z.string().uuid();
export const locationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(3).max(240),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().int().min(20).max(2000),
});
export const shiftSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    location_id: id,
    start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .refine((t) => +t.slice(0, 2) < 24 && +t.slice(3) < 60),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .refine((t) => +t.slice(0, 2) < 24 && +t.slice(3) < 60),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    member_ids: z.array(id).max(200),
  })
  .refine((s) => s.start_time !== s.end_time, {
    message: "Shift start and end must differ",
  });
export const scanSchema = z.object({
  token: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(100),
  action: z.enum(["in", "out"]),
  photo_path: z.string().max(300).nullable().optional(),
});
export const correctionSchema = z.object({
  attendance_id: id,
  requested_time: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(10).max(1000),
});
export const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  review_note: z.string().trim().min(3).max(500),
});
export const inviteSchema = z.object({
  email: z.email().toLowerCase(),
  full_name: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(60),
});
