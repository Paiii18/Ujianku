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

const dateTimeFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

export function formatDateTime(value: string | null) {
  return value ? `${dateTimeFmt.format(new Date(value))} WIB` : "—";
}

// <input type="datetime-local"> ↔ ISO, selalu dalam WIB (sama di server & browser).
// ponytail: satu zona waktu (WIB) untuk semua sekolah; zona per sekolah bila ada sekolah WITA/WIT
const WIB_OFFSET = 7 * 60 * 60 * 1000;

export function toWibInput(iso: string) {
  return new Date(new Date(iso).getTime() + WIB_OFFSET)
    .toISOString()
    .slice(0, 16);
}

export function fromWibInput(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}
