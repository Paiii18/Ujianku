import Link from "next/link";
import { Eye } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import ExamTokenCard from "@/components/teacher/ExamTokenCard";
import ExamWizard, { type WizardExam } from "@/components/teacher/ExamWizard";
import { Button } from "@/components/ui/button";
import { loadTaughtSubjects, type TaughtSubject } from "@/lib/examEditor";
import { toWibInput } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & {
  exam: WizardExam;
  subjects: TaughtSubject[];
  locked: boolean;
  token: string | null;
};

const UUID = /^[0-9a-f-]{36}$/i;

export const getServerSideProps = requireRole(
  "teacher",
  async ({ params }, supabase) => {
    const id = String(params?.id ?? "");
    if (!UUID.test(id)) return null;
    const [{ data: claims }, { data: e }] = await Promise.all([
      supabase.auth.getClaims(),
      // RLS: guru hanya melihat ujian miliknya
      supabase
        .from("exams")
        .select(
          "*, exam_classes(class_id), exam_participants(student_id, student:profiles!exam_participants_student_id_tenant_id_fkey(full_name, nis_nip)), exam_questions(order_no, points, question:questions!exam_questions_question_id_tenant_id_fkey(id, type, content, points)), exam_attempts(count)",
        )
        .eq("id", id)
        .order("order_no", { referencedTable: "exam_questions" })
        .maybeSingle(),
    ]);
    if (!claims?.claims || !e || e.exam_type !== "regular") return null;

    const classIds = e.exam_classes.map((c) => c.class_id);
    const [subjects, { data: fromClasses }] = await Promise.all([
      loadTaughtSubjects(supabase, claims.claims.sub, e.academic_year_id),
      classIds.length
        ? supabase
            .from("class_students")
            .select("student_id")
            .in("class_id", classIds)
        : Promise.resolve({ data: [] as { student_id: string }[] }),
    ]);
    // Murid tambahan = peserta yang bukan anggota kelas terpilih
    const inClass = new Set((fromClasses ?? []).map((s) => s.student_id));

    return {
      subjects,
      locked: (e.exam_attempts[0]?.count ?? 0) > 0,
      token: e.status === "published" ? e.access_token : null,
      exam: {
        id: e.id,
        status: e.status,
        subjectId: e.subject_id,
        title: e.title,
        startAt: toWibInput(e.start_at),
        endAt: toWibInput(e.end_at),
        duration: String(e.duration_minutes),
        kkm: String(Number(e.kkm)),
        classIds,
        students: e.exam_participants
          .filter((p) => !inClass.has(p.student_id))
          .map((p) => ({
            id: p.student_id,
            name: p.student.full_name,
            nis: p.student.nis_nip,
          })),
        questions: e.exam_questions.map((q) => ({
          id: q.question.id,
          type: q.question.type,
          content: q.question.content,
          bankPoints: Number(q.question.points),
          points: q.points === null ? "" : String(Number(q.points)),
        })),
        shuffleQuestions: e.shuffle_questions,
        shuffleOptions: e.shuffle_options,
        requireFullscreen: e.require_fullscreen,
        limitTabs: e.max_tab_switches !== null,
        maxTabSwitches: String(e.max_tab_switches ?? 3),
        essayThreshold: String(Math.round(Number(e.essay_threshold) * 100)),
        scoreVisibility: e.score_visibility,
      },
    };
  },
);

export default function EditExamPage({
  user,
  exam,
  subjects,
  locked,
  token,
}: Props) {
  return (
    <AppShell user={user} title={exam.title}>
      <div className="flex flex-col gap-6">
        {/* Pratinjau memakai soal yang tersimpan; simpan dulu perubahan di wizard */}
        <Button variant="outline" className="h-11 w-fit" asChild>
          <Link href={`/teacher/exams/${exam.id}/preview`}>
            <Eye aria-hidden /> Pratinjau ujian
          </Link>
        </Button>
        {token && <ExamTokenCard examId={exam.id} token={token} />}
        <ExamWizard exam={exam} subjects={subjects} locked={locked} />
      </div>
    </AppShell>
  );
}
