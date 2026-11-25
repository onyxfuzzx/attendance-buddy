export type Page =
  | "Overview"
  | "Attendance"
  | "Team"
  | "Shifts"
  | "Locations"
  | "Requests"
  | "Reports"
  | "Settings"
  | "Check in";
export interface Member {
  id: string;
  org_id: string | null;
  full_name: string;
  email: string;
  role: "admin" | "employee";
  department: string;
  is_active: boolean;
  created_at: string;
}
export interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  token: string;
  is_active: boolean;
}
export interface Shift {
  id: string;
  name: string;
  location_id: string;
  start_time: string;
  end_time: string;
  days: number[];
  is_active: boolean;
}
export interface Attendance {
  id: string;
  user_id: string;
  location_id: string;
  shift_id: string;
  action: "in" | "out";
  status: "on_time" | "late" | "early";
  occurred_at: string;
  distance: number;
  accuracy: number;
  corrected?: boolean;
  photo_path?: string;
}
export interface Correction {
  id: string;
  user_id: string;
  attendance_id: string;
  reason: string;
  requested_time: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  review_note?: string;
}
export interface Invitation {
  id: string;
  email: string;
  full_name: string;
  department: string;
  token: string;
  accepted: boolean;
  revoked: boolean;
  expires_at: string;
}
export interface Audit {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  created_at: string;
}
export interface Workspace {
  organization: { id: string; name: string; timezone: string } | null;
  profile: { id: string; role: "admin" | "employee"; org_id: string | null };
  members: Member[];
  locations: Location[];
  shifts: Shift[];
  attendance: Attendance[];
  corrections: Correction[];
  assignments: { shift_id: string; user_id: string }[];
  invitations: Invitation[];
  audit: Audit[];
}
