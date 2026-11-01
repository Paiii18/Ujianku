import type { Database } from "@/types/database";

// Bentuk jsonb dari RPC get_exam_questions (F3.7). Tanpa kunci jawaban.
export type Answer = {
  selected_option_id?: string | null;
  answer_text?: string | null;
  answer_json?: Record<string, string> | null; // menjodohkan: id kiri → key kanan
};

export type PaperQuestion = {
  id: string;
  type: Database["public"]["Enums"]["question_type"];
  content: string;
  image_path: string | null;
  points: number;
  options: { id: string; content: string; image_path: string | null }[];
  lefts: { id: string; text: string }[];
  rights: { key: string; text: string }[];
  subs: {
    id: string;
    content: string;
    points: number;
    answer: Answer | null;
  }[];
  answer: Answer | null;
};

export type Paper = {
  attempt_id: string;
  exam_id: string;
  title: string;
  deadline_at: string;
  require_fullscreen: boolean;
  max_tab_switches: number | null;
  tab_switch_count: number;
  questions: PaperQuestion[];
};

// Jawaban per id soal / sub-soal
export type Answers = Record<string, Answer>;

export function initialAnswers(paper: Paper): Answers {
  const answers: Answers = {};
  for (const q of paper.questions) {
    if (q.answer) answers[q.id] = q.answer;
    for (const s of q.subs) if (s.answer) answers[s.id] = s.answer;
  }
  return answers;
}

const filled = (text?: string | null) => !!text?.trim();

// Terjawab = semua bagian terisi (semua pasangan, semua sub-soal), agar soal setengah jadi
// tetap tampil kosong di panel nomor.
export function isAnswered(q: PaperQuestion, answers: Answers): boolean {
  const a = answers[q.id];
  switch (q.type) {
    case "multiple_choice":
    case "true_false":
      return !!a?.selected_option_id;
    case "short_answer":
    case "essay":
      return filled(a?.answer_text);
    case "matching":
      return q.lefts.every((l) => !!a?.answer_json?.[l.id]);
    case "multi_essay":
      return q.subs.every((s) => filled(answers[s.id]?.answer_text));
  }
}

// Sisa waktu "jj:mm:dd" / "mm:dd"; negatif = 00:00
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// session_id attempt di perangkat ini (DEC-003). Tidak ada = perangkat baru → masukkan token lagi.
// localStorage bisa diblokir (mode privat): anggap tidak ada.
const sessionKey = (attemptId: string) => `ujian:sesi:${attemptId}`;

export function readSession(attemptId: string): string | null {
  try {
    return localStorage.getItem(sessionKey(attemptId));
  } catch {
    return null;
  }
}

export function writeSession(attemptId: string, sessionId: string) {
  try {
    localStorage.setItem(sessionKey(attemptId), sessionId);
  } catch {
    // ponytail: tanpa localStorage murid diminta token lagi setiap membuka halaman
  }
}

// Tanda ragu-ragu hanya di perangkat ini (tidak dinilai, tidak perlu di server)
const raguKey = (attemptId: string) => `ujian:ragu:${attemptId}`;

export function readRagu(attemptId: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(raguKey(attemptId)) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeRagu(attemptId: string, ids: string[]) {
  try {
    localStorage.setItem(raguKey(attemptId), JSON.stringify(ids));
  } catch {
    // abaikan
  }
}
