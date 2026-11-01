import Link from "next/link";
import { Plus } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Status = "draft" | "published" | "finished";
type Row = {
  id: string;
  title: string;
  subject: string;
  startAt: string;
  endAt: string;
  status: Status;
  token: string | null;
  participants: number;
  questions: number;
};
type Props = ShellProps & { exams: Row[] };

const STATUS: Record<Status, { label: string; className?: string }> = {
  draft: { label: "Draft" },
  published: {
    label: "Terbit",
    className: "bg-success text-success-foreground",
  },
  finished: { label: "Selesai" },
};

// Daftar ujian milik guru (RLS: hanya ujian sendiri), terbaru di atas.
// ponytail: 100 ujian terakhir tanpa pagination; tambah bila guru punya ratusan ujian
export const getServerSideProps = requireRole(
  "teacher",
  async (_ctx, supabase) => {
    const { data } = await supabase
      .from("exams")
      .select(
        "id, title, start_at, end_at, status, access_token, subject:subjects!exams_subject_id_tenant_id_fkey(code), exam_participants(count), exam_questions(count)",
      )
      .order("start_at", { ascending: false })
      .limit(100);
    const now = Date.now();
    return {
      exams: (data ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.subject.code,
        startAt: e.start_at,
        endAt: e.end_at,
        status:
          e.status === "draft"
            ? "draft"
            : new Date(e.end_at).getTime() < now
              ? "finished"
              : "published",
        token: e.access_token,
        participants: e.exam_participants[0]?.count ?? 0,
        questions: e.exam_questions[0]?.count ?? 0,
      })),
    };
  },
);

export default function ExamsPage({ user, exams }: Props) {
  return (
    <AppShell user={user} title="Ujian">
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <Button className="h-11" asChild>
            <Link href="/teacher/exams/new">
              <Plus aria-hidden /> Buat ujian
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mapel</TableHead>
                <TableHead>Jadwal</TableHead>
                <TableHead>Token</TableHead>
                <TableHead className="text-right">Peserta</TableHead>
                <TableHead className="text-right">Soal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada ujian. Mulai dengan tombol Buat ujian.
                  </TableCell>
                </TableRow>
              ) : (
                exams.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="min-w-48 whitespace-normal">
                      <Link
                        href={`/teacher/exams/${e.id}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {e.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS[e.status].className}
                      >
                        {STATUS[e.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>{e.subject}</TableCell>
                    <TableCell className="min-w-44 whitespace-normal text-xs">
                      {formatDateTime(e.startAt)} –<br />
                      {formatDateTime(e.endAt)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {e.token ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {e.participants}
                    </TableCell>
                    <TableCell className="text-right">{e.questions}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
