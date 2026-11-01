import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";
import type { Database } from "@/types/database";

type Exam = Database["public"]["Functions"]["my_exams"]["Returns"][number];
type Group = "upcoming" | "ongoing" | "finished";
type Props = ShellProps & { groups: Record<Group, Exam[]> };

const TABS: { value: Group; label: string; empty: string }[] = [
  {
    value: "ongoing",
    label: "Berlangsung",
    empty: "Tidak ada ujian yang sedang berlangsung.",
  },
  {
    value: "upcoming",
    label: "Akan datang",
    empty: "Belum ada ujian terjadwal.",
  },
  {
    value: "finished",
    label: "Selesai",
    empty: "Belum ada ujian yang selesai.",
  },
];

// Daftar ujian murid (F3.6) lewat RPC my_exams: hanya ujian terbit di mana ia peserta.
// Pengelompokan memakai jam server saat halaman dimuat.
export const getServerSideProps = requireRole(
  "student",
  async (_ctx, supabase) => {
    const { data } = await supabase.rpc("my_exams");
    const now = Date.now();
    const groups: Record<Group, Exam[]> = {
      upcoming: [],
      ongoing: [],
      finished: [],
    };
    for (const e of data ?? []) {
      const group: Group =
        e.attempt_status === "submitted" || new Date(e.end_at).getTime() <= now
          ? "finished"
          : new Date(e.start_at).getTime() > now
            ? "upcoming"
            : "ongoing";
      groups[group].push(e);
    }
    groups.finished.reverse(); // terbaru di atas
    return { groups };
  },
);

function status(e: Exam, group: Group) {
  if (e.attempt_status === "submitted") return "Sudah dikumpulkan";
  if (e.attempt_status === "in_progress")
    return group === "finished" ? "Waktu habis" : "Sedang dikerjakan";
  return group === "finished" ? "Tidak dikerjakan" : "Belum mulai";
}

export default function StudentExamsPage({ user, groups }: Props) {
  return (
    <AppShell user={user} title="Ujian">
      <Tabs
        defaultValue={groups.ongoing.length ? "ongoing" : "upcoming"}
        className="max-w-3xl"
      >
        <TabsList className="w-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label} ({groups[t.value].length})
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {groups[t.value].length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t.empty}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {groups[t.value].map((e) => (
                  <li key={e.id} className="rounded-lg border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{e.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {e.subject_name}
                        </p>
                      </div>
                      <Badge variant="secondary">{status(e, t.value)}</Badge>
                    </div>
                    <p className="mt-2 text-sm">
                      {formatDateTime(e.start_at)} – {formatDateTime(e.end_at)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Durasi {e.duration_minutes} menit
                    </p>
                    {t.value === "ongoing" && (
                      <Button className="mt-3 h-11 w-full sm:w-auto" asChild>
                        <Link href={`/student/exams/${e.id}`}>
                          {e.attempt_status === "in_progress"
                            ? "Lanjutkan"
                            : "Mulai"}
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
