import Link from "next/link";
import { ChevronDown, FileUp, Plus, Search } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import Pagination from "@/components/layout/Pagination";
import DuplicateQuestionButton from "@/components/teacher/DuplicateQuestionButton";
import { EDITABLE_TYPES } from "@/components/teacher/QuestionForm";
import QuestionPreview from "@/components/teacher/QuestionPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
  creator: string;
  mine: boolean;
};
type Filters = { q: string; subject: string; type: string; owner: string };
type Props = ShellProps & {
  questions: Row[];
  subjects: { id: string; code: string; name: string }[];
  filters: Filters;
  page: number;
  total: number;
};

const PAGE_SIZE = 20;
const UUID = /^[0-9a-f-]{36}$/i;

// Ringkasan kunci untuk kolom "Kunci"
function keySummary(q: {
  type: QuestionType;
  accepted_answers: string[] | null;
  answer_key: string | null;
  subCount: number;
  question_options: { label: string; is_correct: boolean }[];
  question_pairs: { count: number }[];
}) {
  if (q.type === "short_answer") return q.accepted_answers?.join(" | ") ?? null;
  if (q.type === "matching")
    return `${q.question_pairs[0]?.count ?? 0} pasangan`;
  if (q.type === "essay") return q.answer_key;
  if (q.type === "multi_essay") return `${q.subCount} sub-soal`;
  const label = q.question_options.find((o) => o.is_correct)?.label;
  if (!label) return null;
  if (q.type === "true_false") return label === "A" ? "Benar" : "Salah";
  return label;
}

// Daftar bank soal: soal sendiri (default) atau semua guru di sekolah; filter mapel/tipe, cari teks,
// pagination server 20 per halaman. Soal guru lain hanya bisa dipratinjau & diduplikat (DEC-029).
// ponytail: cari pakai ilike tanpa index trigram — cukup untuk ratusan soal per sekolah.
export const getServerSideProps = requireRole(
  "teacher",
  async ({ query }, supabase) => {
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims) return null;
    const me = claims.claims.sub;
    const filters: Filters = {
      q: String(query.q ?? "")
        .trim()
        .slice(0, 100),
      subject: UUID.test(String(query.subject)) ? String(query.subject) : "",
      type: EDITABLE_TYPES.includes(query.type as QuestionType)
        ? String(query.type)
        : "",
      owner: query.owner === "all" ? "all" : "me",
    };
    const page = Math.max(1, Number(query.page) || 1);
    const from = (page - 1) * PAGE_SIZE;

    let request = supabase
      .from("questions")
      .select(
        "id, type, content, points, created_by, accepted_answers, answer_key, subject:subjects!questions_subject_id_tenant_id_fkey(code), creator:profiles!questions_created_by_tenant_id_fkey(full_name), question_options(label, is_correct), question_pairs(count)",
        { count: "exact" },
      )
      .is("parent_id", null);
    if (filters.owner === "me") request = request.eq("created_by", me);
    if (filters.subject) request = request.eq("subject_id", filters.subject);
    if (filters.type)
      request = request.eq("type", filters.type as QuestionType);
    if (filters.q)
      request = request.ilike(
        "content",
        `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`,
      );

    const [{ data, count }, { data: subjects }] = await Promise.all([
      request
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + PAGE_SIZE - 1),
      supabase.from("subjects").select("id, code, name").order("code"),
    ]);

    // Jumlah sub-soal per induk multi essay di halaman ini (maks 20 × 20 baris)
    const multiIds = (data ?? [])
      .filter((q) => q.type === "multi_essay")
      .map((q) => q.id);
    const { data: subs } = multiIds.length
      ? await supabase
          .from("questions")
          .select("parent_id")
          .in("parent_id", multiIds)
      : { data: [] };
    const subCount = new Map<string, number>();
    for (const sub of subs ?? [])
      if (sub.parent_id)
        subCount.set(sub.parent_id, (subCount.get(sub.parent_id) ?? 0) + 1);

    return {
      filters,
      page,
      total: count ?? 0,
      subjects: subjects ?? [],
      questions: (data ?? []).map((q) => ({
        id: q.id,
        type: q.type,
        subject: q.subject.code,
        content: q.content,
        points: Number(q.points),
        key: keySummary({ ...q, subCount: subCount.get(q.id) ?? 0 }),
        creator: q.creator.full_name,
        mine: q.created_by === me,
      })),
    };
  },
);

// ponytail: <select> native, gaya disamakan dengan Input
const SELECT =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export default function QuestionsPage({
  user,
  questions,
  subjects,
  filters,
  page,
  total,
}: Props) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showAll = filters.owner === "all";
  const filtered = !!(filters.q || filters.subject || filters.type);
  const href = (p: number) =>
    `/teacher/questions?${new URLSearchParams({
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      page: String(p),
    })}`;

  return (
    <AppShell user={user} title="Bank soal">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-11" asChild>
            <Link href="/teacher/questions/import">
              <FileUp aria-hidden /> Import Excel
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-11">
                <Plus aria-hidden /> Buat soal <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {EDITABLE_TYPES.map((t) => (
                <DropdownMenuItem key={t} asChild className="min-h-11">
                  <Link href={`/teacher/questions/new?type=${t}`}>
                    {QUESTION_TYPE_LABEL[t]}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* GET form biasa: filter ada di URL, bisa di-refresh/dibagikan; ganti filter = halaman 1 */}
        <form
          role="search"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_repeat(3,minmax(0,11rem))_auto]"
        >
          <Input
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Cari teks soal"
            aria-label="Cari teks soal"
            className="h-11"
          />
          <select
            name="subject"
            aria-label="Mapel"
            defaultValue={filters.subject}
            className={SELECT}
          >
            <option value="">Semua mapel</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <select
            name="type"
            aria-label="Tipe soal"
            defaultValue={filters.type}
            className={SELECT}
          >
            <option value="">Semua tipe</option>
            {EDITABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {QUESTION_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <select
            name="owner"
            aria-label="Pembuat"
            defaultValue={filters.owner}
            className={SELECT}
          >
            <option value="me">Soal saya</option>
            <option value="all">Semua guru</option>
          </select>
          <Button type="submit" variant="outline" className="h-11">
            <Search aria-hidden /> Terapkan
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          {total} soal{filtered && " cocok dengan filter"}
          {showAll ? " dari semua guru" : " buatan Anda"}. Soal guru lain bisa
          dipratinjau dan diduplikat menjadi milik Anda.
        </p>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Soal</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Mapel</TableHead>
                {showAll && <TableHead>Pembuat</TableHead>}
                <TableHead>Kunci</TableHead>
                <TableHead className="text-right">Poin</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={showAll ? 7 : 6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {filtered
                      ? "Tidak ada soal yang cocok."
                      : "Belum ada soal. Mulai dengan tombol Buat soal."}
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="max-w-md min-w-56 whitespace-normal">
                      {q.mine ? (
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
                    {showAll && (
                      <TableCell className="min-w-32 whitespace-normal">
                        {q.mine ? "Anda" : q.creator}
                      </TableCell>
                    )}
                    <TableCell className="max-w-48 whitespace-normal">
                      <span className="line-clamp-2">{q.key ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-right">{q.points}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <QuestionPreview questionId={q.id} />
                        <DuplicateQuestionButton questionId={q.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination page={page} pages={pages} href={href} />
      </div>
    </AppShell>
  );
}
