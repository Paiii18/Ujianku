import AppShell from "@/components/layout/AppShell";
import EmptyDashboard from "@/components/layout/EmptyDashboard";
import { requireRole, type ShellProps } from "@/lib/requireRole";

export const getServerSideProps = requireRole("teacher");

export default function TeacherDashboard({ user }: ShellProps) {
  return (
    <AppShell user={user} title="Dashboard">
      <EmptyDashboard
        name={user.fullName}
        text="Ujian, bank soal, dan antrean koreksi Anda akan tampil di sini."
      />
    </AppShell>
  );
}
