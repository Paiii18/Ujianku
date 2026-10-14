import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];

// Halaman awal per peran; juga dipakai proxy (F1.6) untuk mencocokkan prefix URL.
export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/admin",
  school_admin: "/school",
  teacher: "/teacher",
  student: "/student",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  school_admin: "Admin Sekolah",
  teacher: "Guru",
  student: "Murid",
};

// Murid tidak punya email: login memakai email sintetis dari NIS + kode sekolah.
export function studentEmail(schoolCode: string, nis: string) {
  return `${nis.trim()}@${schoolCode.trim().toLowerCase()}.siswa.local`;
}
