import type { Database } from "@/types/database";

// Zona waktu tetap agar hasil server (gSSP) dan browser sama (tidak ada hydration mismatch).
const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export function formatDate(value: string | null) {
  return value ? dateFmt.format(new Date(value)) : "—";
}

const rupiahFmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(value: number) {
  return rupiahFmt.format(value);
}

export const SEMESTER_LABEL: Record<number, string> = {
  1: "Ganjil",
  2: "Genap",
};

export const QUESTION_TYPE_LABEL: Record<
  Database["public"]["Enums"]["question_type"],
  string
> = {
  multiple_choice: "Pilihan ganda",
  true_false: "Benar/Salah",
  short_answer: "Isian singkat",
  matching: "Menjodohkan",
  essay: "Essay",
  multi_essay: "Multi essay",
};
