import AppShell from "@/components/layout/AppShell";
import EmptyDashboard from "@/components/layout/EmptyDashboard";
import { requireRole, type ShellProps } from "@/lib/requireRole";

export const getServerSideProps = requireRole("student");

export default function StudentHome({ user }: ShellProps) {
  return (
    <AppShell user={user} title="Beranda">
      <EmptyDashboard
        name={user.fullName}
        text="Ujian yang akan datang dan sedang berlangsung akan tampil di sini."
      />
    </AppShell>
  );
}
