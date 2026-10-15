import { randomUUID } from "node:crypto";
import AppShell from "@/components/layout/AppShell";
import QuestionForm, {
  type ChoiceQuestion,
} from "@/components/teacher/QuestionForm";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import { loadEditorContext } from "@/lib/questionEditor";
import { requireRole, type ShellProps } from "@/lib/requireRole";

type Props = ShellProps & {
  question: ChoiceQuestion;
  subjects: { id: string; code: string; name: string }[];
  folder: string;
};

export const getServerSideProps = requireRole(
  "teacher",
  async ({ query }, supabase) => {
    const type = query.type;
    if (type !== "multiple_choice" && type !== "true_false") return null;
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
        : Array.from({ length: 4 }, () => ({
            content: "",
            imagePath: null,
            isCorrect: false,
          }));
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
