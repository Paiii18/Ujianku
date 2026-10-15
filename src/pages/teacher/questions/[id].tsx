import AppShell from "@/components/layout/AppShell";
import QuestionForm, {
  type ChoiceQuestion,
} from "@/components/teacher/QuestionForm";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import { loadEditorContext } from "@/lib/questionEditor";
import { signQuestionImages } from "@/lib/questionImage";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & {
  question: ChoiceQuestion;
  subjects: { id: string; code: string; name: string }[];
  folder: string;
  previews: Record<string, string>;
};

const UUID = /^[0-9a-f-]{36}$/i;

export const getServerSideProps = requireRole(
  "teacher",
  async ({ params }, supabase) => {
    const id = String(params?.id ?? "");
    if (!UUID.test(id)) return null;
    const ctx = await loadEditorContext(supabase);
    if (!ctx) return null;
    const { data: q } = await supabase
      .from("questions")
      .select(
        "id, type, subject_id, content, image_path, points, explanation, created_by, question_options(label, content, image_path, is_correct)",
      )
      .eq("id", id)
      .order("label", { referencedTable: "question_options" })
      .maybeSingle();
    // Hanya soal milik sendiri bertipe PG/BS yang bisa diubah di editor ini
    if (
      !q ||
      q.created_by !== ctx.userId ||
      (q.type !== "multiple_choice" && q.type !== "true_false")
    ) {
      return null;
    }
    const options = q.question_options.map((o) => ({
      content: o.content,
      imagePath: o.image_path,
      isCorrect: o.is_correct,
    }));
    return {
      subjects: ctx.subjects,
      folder: `${ctx.tenantId}/${q.id}`,
      previews: await signQuestionImages(supabase, [
        q.image_path,
        ...options.map((o) => o.imagePath),
      ]),
      question: {
        id: q.id,
        type: q.type,
        subjectId: q.subject_id,
        content: q.content,
        imagePath: q.image_path,
        points: Number(q.points),
        explanation: q.explanation ?? "",
        options,
      },
    };
  },
);

export default function EditQuestionPage({
  user,
  question,
  subjects,
  folder,
  previews,
}: Props) {
  return (
    <AppShell
      user={user}
      title={`Ubah soal: ${QUESTION_TYPE_LABEL[question.type]}`}
    >
      <QuestionForm
        question={question}
        subjects={subjects}
        folder={folder}
        previews={previews}
      />
    </AppShell>
  );
}
