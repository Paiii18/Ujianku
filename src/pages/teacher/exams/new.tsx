import { randomUUID } from "node:crypto";
import AppShell from "@/components/layout/AppShell";
import ExamWizard, { type WizardExam } from "@/components/teacher/ExamWizard";
import { loadTaughtSubjects, type TaughtSubject } from "@/lib/examEditor";
import { toWibInput } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & { exam: WizardExam; subjects: TaughtSubject[] };

export const getServerSideProps = requireRole(
  "teacher",
  async (_ctx, supabase) => {
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims) return null;
    const subjects = await loadTaughtSubjects(supabase, claims.claims.sub);
    // Default: besok 07.00–09.00 WIB, 90 menit
    const tomorrow = toWibInput(
      new Date(Date.now() + 86_400_000).toISOString(),
    ).slice(0, 10);
    return {
      subjects,
      exam: {
        id: randomUUID(), // dibuat di sini: klik simpan dua kali tidak membuat dua ujian
        status: "draft",
        subjectId: subjects.length === 1 ? subjects[0].id : "",
        title: "",
        startAt: `${tomorrow}T07:00`,
        endAt: `${tomorrow}T09:00`,
        duration: "90",
        kkm: "75",
        classIds: [],
        students: [],
        questions: [],
        shuffleQuestions: true,
        shuffleOptions: true,
        requireFullscreen: true,
        limitTabs: false,
        maxTabSwitches: "3",
        essayThreshold: "80",
        scoreVisibility: "score",
      },
    };
  },
);

export default function NewExamPage({ user, exam, subjects }: Props) {
  return (
    <AppShell user={user} title="Buat ujian">
      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Anda belum punya penugasan mengajar di tahun ajaran aktif. Hubungi
          Admin Sekolah.
        </p>
      ) : (
        <ExamWizard exam={exam} subjects={subjects} locked={false} />
      )}
    </AppShell>
  );
}
