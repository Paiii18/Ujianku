import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";
import type { Database } from "@/types/database";

type QuestionType = Database["public"]["Enums"]["question_type"];
type Row = {
  id: string;
  type: QuestionType;
  subject: string;
  content: string;
  points: number;
  key: string | null;
};
type Props = ShellProps & { questions: Row[] };

// Tipe yang sudah punya editor (F2.10/F2.11 menambah sisanya)
const CREATABLE: QuestionType[] = ["multiple_choice", "true_false"];

// ponytail: 50 soal terbaru milik sendiri; filter, cari, pagination & soal guru lain di F2.12
export const getServerSideProps = requireRole(
  "teacher",
  async (_ctx, supabase) => {
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims) return null;
    const { data } = await supabase
      .from("questions")
      .select(
        "id, type, content, points, subject:subjects!questions_subject_id_tenant_id_fkey(code), question_options(label, is_correct)",
      )
      .eq("created_by", claims.claims.sub)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(50);
    return {
      questions: (data ?? []).map((q) => {
        const key = q.question_options.find((o) => o.is_correct)?.label;
        return {
          id: q.id,
          type: q.type,
          subject: q.subject.code,
          content: q.content,
          points: Number(q.points),
          key: key
            ? q.type === "true_false"
              ? key === "A"
                ? "Benar"
                : "Salah"
              : key
            : null,
        };
      }),
    };
  },
);

export default function QuestionsPage({ user, questions }: Props) {
  return (
    <AppShell user={user} title="Bank soal">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            50 soal terbaru buatan Anda.
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-11">
                <Plus aria-hidden /> Buat soal <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CREATABLE.map((t) => (
                <DropdownMenuItem key={t} asChild className="min-h-11">
                  <Link href={`/teacher/questions/new?type=${t}`}>
                    {QUESTION_TYPE_LABEL[t]}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Soal</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Mapel</TableHead>
                <TableHead>Kunci</TableHead>
                <TableHead className="text-right">Poin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Belum ada soal. Mulai dengan tombol Buat soal.
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-md min-w-56 whitespace-normal">
                      {CREATABLE.includes(q.type) ? (
                        <Link
                          href={`/teacher/questions/${q.id}`}
                          className="line-clamp-2 text-primary underline-offset-4 hover:underline"
                        >
                          {q.content}
                        </Link>
                      ) : (
                        <span className="line-clamp-2">{q.content}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {QUESTION_TYPE_LABEL[q.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{q.subject}</TableCell>
                    <TableCell>{q.key ?? "—"}</TableCell>
                    <TableCell className="text-right">{q.points}</TableCell>
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
