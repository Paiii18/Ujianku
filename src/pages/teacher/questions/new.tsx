import { randomUUID } from "node:crypto";
import AppShell from "@/components/layout/AppShell";
import QuestionForm, {
  EDITABLE_TYPES,
  type EditableType,
  type EditorQuestion,
} from "@/components/teacher/QuestionForm";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import { loadEditorContext } from "@/lib/questionEditor";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & {
  question: EditorQuestion;
  subjects: { id: string; code: string; name: string }[];
  folder: string;
};

export const getServerSideProps = requireRole(
  "teacher",
  async ({ query }, supabase) => {
    const type = query.type as EditableType;
    if (!EDITABLE_TYPES.includes(type)) return null;
    const ctx = await loadEditorContext(supabase);
    if (!ctx) return null;
    // Id dibuat di sini agar gambar bisa diunggah ke foldernya sebelum soal disimpan (DEC-030)
    const id = randomUUID();
    const options =
      type === "true_false"
        ? ["Benar", "Salah"].map((content) => ({
            content,
            imagePath: null,
            isCorrect: false,
          }))
        : type === "multiple_choice"
          ? Array.from({ length: 4 }, () => ({
              content: "",
              imagePath: null,
              isCorrect: false,
            }))
          : [];
    return {
      subjects: ctx.subjects,
      folder: `${ctx.tenantId}/${id}`,
      question: {
        id,
        type,
        subjectId: ctx.subjects.length === 1 ? ctx.subjects[0].id : "",
        content: "",
        imagePath: null,
        points: 1,
        explanation: "",
        options,
        answers: type === "short_answer" ? [""] : [],
        pairs:
          type === "matching"
            ? Array.from({ length: 3 }, () => ({ left: "", right: "" }))
            : [],
        answerKey: "",
        keywords: [],
        subs:
          type === "multi_essay"
            ? Array.from({ length: 2 }, () => ({
                id: null,
                content: "",
                answerKey: "",
                keywords: [],
                points: 1,
              }))
            : [],
      },
    };
  },
);

export default function NewQuestionPage({
  user,
  question,
  subjects,
  folder,
}: Props) {
  return (
    <AppShell
      user={user}
      title={`Soal baru: ${QUESTION_TYPE_LABEL[question.type]}`}
    >
      <QuestionForm
        question={question}
        subjects={subjects}
        folder={folder}
        previews={{}}
      />
    </AppShell>
  );
}
