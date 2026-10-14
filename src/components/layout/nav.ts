import {
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  RotateCcw,
  School,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Halaman belum dibuat: tampil non-aktif dengan label "Segera". Hapus saat fitur selesai.
  soon?: boolean;
};

// Menu sesuai matriks akses PRD. Tugas pembuatnya di komentar.
export const NAV: Record<UserRole, NavItem[]> = {
  super_admin: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/schools", label: "Sekolah", icon: Building2 }, // F1.8
    {
      href: "/admin/subscriptions",
      label: "Langganan",
      icon: CreditCard,
    }, // F1.9
    { href: "/admin/audit", label: "Audit log", icon: History, soon: true }, // F4.10
  ],
  school_admin: [
    { href: "/school", label: "Dashboard", icon: LayoutDashboard },
    {
      href: "/school/academic-years",
      label: "Tahun ajaran",
      icon: CalendarRange,
      soon: true,
    }, // F2.2
    { href: "/school/subjects", label: "Mapel", icon: BookOpen, soon: true }, // F2.2
    { href: "/school/classes", label: "Kelas", icon: School, soon: true }, // F2.5
    { href: "/school/teachers", label: "Guru", icon: UserCog, soon: true }, // F2.3
    { href: "/school/students", label: "Murid", icon: Users, soon: true }, // F2.3
    {
      href: "/school/assignments",
      label: "Penugasan guru",
      icon: ClipboardList,
      soon: true,
    }, // F2.6
    {
      href: "/school/retakes",
      label: "Ujian ulang",
      icon: RotateCcw,
      soon: true,
    }, // F4.3
    {
      href: "/school/reports",
      label: "Report",
      icon: FileBarChart,
      soon: true,
    }, // F4.7
    { href: "/school/audit", label: "Audit log", icon: History, soon: true }, // F4.10
  ],
  teacher: [
    { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
    {
      href: "/teacher/questions",
      label: "Bank soal",
      icon: Library,
      soon: true,
    }, // F2.12
    { href: "/teacher/exams", label: "Ujian", icon: GraduationCap, soon: true }, // F3.3
    {
      href: "/teacher/grading",
      label: "Koreksi",
      icon: ClipboardCheck,
      soon: true,
    }, // F3.13
    {
      href: "/teacher/reports",
      label: "Report",
      icon: FileBarChart,
      soon: true,
    }, // F4.5
  ],
  student: [
    { href: "/student", label: "Beranda", icon: LayoutDashboard },
    { href: "/student/exams", label: "Ujian", icon: GraduationCap, soon: true }, // F3.6
    { href: "/student/grades", label: "Nilai", icon: Trophy, soon: true }, // F3.14
  ],
};
