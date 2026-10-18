import AppShell from "@/components/layout/AppShell";
import QuestionForm, {
  EDITABLE_TYPES,
  type EditableType,
  type EditorQuestion,
} from "@/components/teacher/QuestionForm";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import { loadEditorContext } from "@/lib/questionEditor";
import { signQuestionImages } from "@/lib/questionImage";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & {
  question: EditorQuestion;
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
        "id, type, subject_id, content, image_path, points, explanation, accepted_answers, answer_key, keywords, parent_id, created_by, question_options(label, content, image_path, is_correct), question_pairs(left_text, right_text, position)",
      )
      .eq("id", id)
      .order("label", { referencedTable: "question_options" })
      .order("position", { referencedTable: "question_pairs" })
      .maybeSingle();
    // Hanya soal milik sendiri bertipe yang sudah punya editor
    if (
      !q ||
      q.created_by !== ctx.userId ||
      q.parent_id !== null || // sub-soal diubah lewat induknya
      !EDITABLE_TYPES.includes(q.type as EditableType)
    ) {
      return null;
    }
    const { data: subs } =
      q.type === "multi_essay"
        ? await supabase
            .from("questions")
            .select("id, content, answer_key, keywords, points")
            .eq("parent_id", q.id)
            .order("position")
        : { data: [] };
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
        type: q.type as EditableType,
        subjectId: q.subject_id,
        content: q.content,
        imagePath: q.image_path,
        points: Number(q.points),
        explanation: q.explanation ?? "",
        options,
        answers: q.accepted_answers ?? [],
        pairs: q.question_pairs.map((p) => ({
          left: p.left_text,
          right: p.right_text,
        })),
        answerKey: q.answer_key ?? "",
        keywords: q.keywords ?? [],
        subs: (subs ?? []).map((sub) => ({
          id: sub.id,
          content: sub.content,
          answerKey: sub.answer_key ?? "",
          keywords: sub.keywords ?? [],
          points: Number(sub.points),
        })),
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
