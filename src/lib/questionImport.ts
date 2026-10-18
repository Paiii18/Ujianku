import * as XLSX from "xlsx";
import type { Database } from "../types/database";
import { headerIndex, readGrid } from "./spreadsheet";

// Import soal dari Excel / CSV (F2.13). Dua tahap murni (tanpa I/O) agar bisa diuji:
// baca sheet → validasi dengan data sekolah. Batas validasi = save_question (F2.9–F2.11),
// agar file yang lolos pratinjau juga lolos RPC import (F2.14).
// Gambar (kolom gambar / opsi "img:nama.png") = nama file di ZIP; di sini hanya dicek bentuknya,
// keberadaan di ZIP dicek API import (F2.14). URL belum didukung (DEC-036, risiko SSRF).

type QuestionType = Database["public"]["Enums"]["question_type"];

export const MAX_ROWS = 500;
const HEADERS = [
  "no",
  "tipe",
  "kode_mapel",
  "soal",
  "gambar",
  "opsi_a",
  "opsi_b",
  "opsi_c",
  "opsi_d",
  "opsi_e",
  "kunci",
  "pasangan",
  "kunci_essay",
  "kata_kunci",
  "poin",
  "induk",
  "pembahasan",
] as const;
type Header = (typeof HEADERS)[number];
const OPTION_COLS = ["opsi_a", "opsi_b", "opsi_c", "opsi_d", "opsi_e"] as const;
const LABELS = ["A", "B", "C", "D", "E"] as const;

const TYPES: Record<string, QuestionType> = {
  PG: "multiple_choice",
  BS: "true_false",
  ISIAN: "short_answer",
  JODOH: "matching",
  ESSAY: "essay",
  MULTI: "multi_essay",
};

export type RawQuestionRow = { row: number } & Record<Header, string>;

export type ImportOption = {
  label: (typeof LABELS)[number];
  content: string;
  image: string | null;
  isCorrect: boolean;
};

export type ImportQuestion = {
  row: number; // nomor baris di Excel (header = baris 1)
  no: number | null;
  parentNo: number | null; // sub-soal multi essay: no induk
  type: QuestionType | null;
  subjectId: string | null;
  content: string;
  image: string | null; // nama file di ZIP
  points: number;
  explanation: string;
  options: ImportOption[];
  answers: string[];
  pairs: { left: string; right: string }[];
  answerKey: string;
  keywords: string[];
  errors: string[];
};

export function readQuestionRows(
  file: ArrayBuffer,
): { rows: RawQuestionRow[] } | { error: string } {
  const read = readGrid(file, MAX_ROWS);
  if ("error" in read) return read;
  const head = headerIndex(read.grid[0], HEADERS);
  if ("error" in head) return head;

  const rows = read.grid
    .slice(1)
    .map((r, i) => {
      const raw = { row: i + 2 } as RawQuestionRow;
      for (const h of HEADERS) raw[h] = (r[head.col[h]] ?? "").trim();
      return raw;
    })
    .filter((r) => HEADERS.some((h) => r[h]));

  if (rows.length === 0) return { error: "File tidak berisi soal." };
  if (rows.length > MAX_ROWS) {
    return { error: `Maksimal ${MAX_ROWS} soal per file.` };
  }
  return { rows };
}

// subjects: kode mapel (huruf kecil) → id mapel sekolah ini.
export function validateQuestionRows(
  rows: RawQuestionRow[],
  ctx: { subjects: Map<string, string> },
): ImportQuestion[] {
  const firstRowOfNo = new Map<number, number>();
  const result = rows.map((r) => {
    const errors: string[] = [];
    const isSub = r.induk !== "";

    const no = toInt(r.no);
    if (no === null) errors.push("No wajib berupa angka bulat positif");
    else if (firstRowOfNo.has(no)) {
      errors.push(`No sama dengan baris ${firstRowOfNo.get(no)}`);
    } else firstRowOfNo.set(no, r.row);

    const parentNo = isSub ? toInt(r.induk) : null;
    if (isSub && parentNo === null) {
      errors.push("Induk wajib berupa No soal MULTI");
    }

    const tipe = r.tipe.toUpperCase();
    let type: QuestionType | null = TYPES[tipe] ?? null;
    if (isSub) {
      // Sub-soal multi essay = essay; tipe boleh dikosongkan
      if (tipe && tipe !== "ESSAY") errors.push("Tipe sub-soal harus ESSAY");
      type = "essay";
    } else if (!type) {
      errors.push("Tipe wajib PG, BS, ISIAN, JODOH, ESSAY, atau MULTI");
    }

    // Sub-soal mewarisi mapel induk (dicek setelah semua baris dibaca)
    let subjectId: string | null = null;
    if (r.kode_mapel) {
      subjectId = ctx.subjects.get(r.kode_mapel.toLowerCase()) ?? null;
      if (!subjectId) errors.push(`Kode mapel "${r.kode_mapel}" tidak dikenal`);
    } else if (!isSub) errors.push("Kode mapel wajib diisi");

    if (!r.soal) errors.push("Soal wajib diisi");
    else if (r.soal.length > 10000)
      errors.push("Soal maksimal 10.000 karakter");
    if (r.pembahasan.length > 10000) {
      errors.push("Pembahasan maksimal 10.000 karakter");
    }

    const image = r.gambar || null;
    if (image && isSub) errors.push("Sub-soal tidak bisa diberi gambar");
    else if (image) checkImage(image, "Gambar", errors);
    if (isSub && r.pembahasan) {
      errors.push("Pembahasan sub-soal tidak didukung; tulis di soal induk");
    }

    // Poin induk multi essay = jumlah poin sub-soal (dihitung RPC), kolom poin diabaikan
    let points = 0;
    if (type !== "multi_essay") {
      points = r.poin === "" ? 1 : toNumber(r.poin);
      if (!(points >= 0.01 && points <= 1000)) {
        errors.push("Poin harus lebih dari 0 (maks 1.000)");
      }
    }

    const q: ImportQuestion = {
      row: r.row,
      no,
      parentNo,
      type,
      subjectId,
      content: r.soal,
      image,
      points,
      explanation: isSub ? "" : r.pembahasan,
      options: [],
      answers: [],
      pairs: [],
      answerKey: "",
      keywords: [],
      errors,
    };
    if (type === "multiple_choice") q.options = choiceOptions(r, errors);
    if (type === "true_false") q.options = trueFalseOptions(r.kunci, errors);
    if (type === "short_answer") q.answers = shortAnswers(r.kunci, errors);
    if (type === "matching") q.pairs = matchingPairs(r.pasangan, errors);
    if (type === "essay") {
      q.answerKey = r.kunci_essay;
      if (!q.answerKey) errors.push("Kunci essay (jawaban acuan) wajib diisi");
      else if (q.answerKey.length > 10000) {
        errors.push("Kunci essay maksimal 10.000 karakter");
      }
      q.keywords = cleanKeywords(r.kata_kunci);
      if (q.keywords.length > 20 || q.keywords.some((k) => k.length > 50)) {
        errors.push("Maksimal 20 kata kunci, masing-masing 50 karakter");
      }
    }
    return q;
  });

  // Hubungan induk ↔ sub-soal
  const byNo = new Map(
    result.filter((q) => q.no !== null).map((q) => [q.no, q]),
  );
  const subCount = new Map<number, number>();
  for (const q of result) {
    if (q.parentNo === null) continue;
    const parent = byNo.get(q.parentNo);
    if (!parent || parent.type !== "multi_essay") {
      q.errors.push(`Induk ${q.parentNo} bukan soal MULTI di file ini`);
      continue;
    }
    if (q.subjectId && parent.subjectId && q.subjectId !== parent.subjectId) {
      q.errors.push("Kode mapel sub-soal harus sama dengan induk");
    }
    q.subjectId = parent.subjectId;
    subCount.set(q.parentNo, (subCount.get(q.parentNo) ?? 0) + 1);
  }
  for (const q of result) {
    if (q.type !== "multi_essay" || q.no === null) continue;
    const n = subCount.get(q.no) ?? 0;
    if (n < 2 || n > 20) {
      q.errors.push(`Soal MULTI harus punya 2–20 sub-soal (ada ${n})`);
    }
  }
  return result;
}

function choiceOptions(r: RawQuestionRow, errors: string[]): ImportOption[] {
  const values = OPTION_COLS.map((c) => r[c]);
  const count = values.findLastIndex((v) => v !== "") + 1;
  if (count < 2)
    errors.push("Soal PG harus punya minimal 2 opsi (opsi_a, opsi_b)");
  else if (values.slice(0, count).includes("")) {
    errors.push("Opsi PG harus berurutan dari opsi_a tanpa ada yang kosong");
  }
  const key = r.kunci.toUpperCase();
  const keyIndex = LABELS.indexOf(key as ImportOption["label"]);
  if (keyIndex < 0 || keyIndex >= count) {
    errors.push("Kunci PG harus huruf salah satu opsi yang diisi (A–E)");
  }
  return values.slice(0, count).map((v, i) => {
    const img = v.toLowerCase().startsWith("img:") ? v.slice(4).trim() : null;
    if (img !== null) checkImage(img, `Opsi ${LABELS[i]}`, errors);
    else if (v.length > 2000)
      errors.push(`Opsi ${LABELS[i]} maksimal 2.000 karakter`);
    return {
      label: LABELS[i],
      content: img === null ? v : "",
      image: img || null,
      isCorrect: i === keyIndex,
    };
  });
}

function trueFalseOptions(kunci: string, errors: string[]): ImportOption[] {
  const key = kunci.toUpperCase();
  const correct =
    key === "B" || key === "BENAR"
      ? 0
      : key === "S" || key === "SALAH"
        ? 1
        : -1;
  if (correct < 0) errors.push("Kunci BS harus B (benar) atau S (salah)");
  // Sama dengan editor (TF_OPTIONS di QuestionForm)
  return ["Benar", "Salah"].map((content, i) => ({
    label: LABELS[i],
    content,
    image: null,
    isCorrect: i === correct,
  }));
}

function shortAnswers(kunci: string, errors: string[]) {
  const answers = splitPipe(kunci);
  if (answers.length < 1 || answers.length > 10) {
    errors.push("Kunci isian harus berisi 1–10 jawaban, pisahkan dengan |");
  }
  if (answers.some((a) => a.length > 200)) {
    errors.push("Setiap jawaban isian maksimal 200 karakter");
  }
  if (hasDuplicate(answers)) errors.push("Ada jawaban isian yang sama");
  return answers;
}

function matchingPairs(pasangan: string, errors: string[]) {
  const parts = splitPipe(pasangan);
  const pairs = parts.map((p) => {
    const at = p.indexOf("=");
    return at < 0
      ? { left: p, right: "" }
      : { left: p.slice(0, at).trim(), right: p.slice(at + 1).trim() };
  });
  if (pairs.length < 2 || pairs.length > 10) {
    errors.push(
      "Pasangan harus berisi 2–10 pasangan kiri=kanan, pisahkan dengan |",
    );
  }
  if (pairs.some((p) => !p.left || !p.right)) {
    errors.push("Setiap pasangan harus berbentuk kiri=kanan");
  } else if (pairs.some((p) => p.left.length > 500 || p.right.length > 500)) {
    errors.push("Teks pasangan maksimal 500 karakter");
  }
  if (
    hasDuplicate(pairs.map((p) => p.left)) ||
    hasDuplicate(pairs.map((p) => p.right))
  ) {
    errors.push("Teks di sisi kiri maupun kanan tidak boleh sama");
  }
  return pairs;
}

// Nama file di ZIP (jpg/png/webp, tanpa folder)
function checkImage(value: string, label: string, errors: string[]) {
  if (/^https?:\/\//i.test(value)) {
    errors.push(`${label}: URL belum didukung, masukkan gambar ke file ZIP`);
  } else if (!/^[^/\\]+\.(jpe?g|png|webp)$/i.test(value)) {
    errors.push(`${label}: isi nama file JPG/PNG/WebP di ZIP`);
  }
}

// Kata kunci: pisah koma, trim, buang kosong & kembar (sama dengan clean_keywords di DB)
function cleanKeywords(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((k) => k.trim())
    .filter((k) => {
      const key = k.toLowerCase();
      if (!k || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function splitPipe(value: string) {
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Sama dengan pembanding save_question: huruf kecil + spasi tunggal
function hasDuplicate(values: string[]) {
  const norm = values.map((v) => v.toLowerCase().replace(/\s+/g, " "));
  return new Set(norm).size !== norm.length;
}

function toInt(value: string) {
  return /^\d{1,6}$/.test(value) && Number(value) > 0 ? Number(value) : null;
}

// Excel berlokal Indonesia memakai koma desimal ("1,5")
function toNumber(value: string) {
  const v = value.replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : NaN;
}

// Template: sheet "Soal" (header + contoh tiap tipe), "Mapel" (kode mapel sekolah),
// "Petunjuk" (arti kolom).
export function buildQuestionTemplate(
  subjects: { code: string; name: string }[],
): Buffer {
  const code = subjects[0]?.code ?? "MTK";
  const example = (values: Partial<Record<Header, string | number>>) =>
    HEADERS.map((h) => values[h] ?? "");
  const ws = XLSX.utils.aoa_to_sheet([
    [...HEADERS],
    example({
      no: 1,
      tipe: "PG",
      kode_mapel: code,
      soal: "Hasil dari 12 × 8 adalah ...",
      opsi_a: 96,
      opsi_b: 86,
      opsi_c: 108,
      opsi_d: 92,
      kunci: "A",
      poin: 2,
      pembahasan: "12 × 8 = 96",
    }),
    example({
      no: 2,
      tipe: "BS",
      kode_mapel: code,
      soal: "Matahari terbit dari timur.",
      kunci: "B",
      poin: 1,
    }),
    example({
      no: 3,
      tipe: "ISIAN",
      kode_mapel: code,
      soal: "Ibu kota Indonesia adalah ...",
      kunci: "Jakarta|DKI Jakarta",
      poin: 1,
    }),
    example({
      no: 4,
      tipe: "JODOH",
      kode_mapel: code,
      soal: "Pasangkan kota dengan negaranya.",
      pasangan: "Jakarta=Indonesia|Tokyo=Jepang|Paris=Prancis",
      poin: 3,
    }),
    example({
      no: 5,
      tipe: "ESSAY",
      kode_mapel: code,
      soal: "Jelaskan proses fotosintesis.",
      kunci_essay:
        "Fotosintesis adalah proses tumbuhan membuat makanan dengan bantuan cahaya matahari dan klorofil.",
      kata_kunci: "klorofil, cahaya",
      poin: 5,
    }),
    example({
      no: 6,
      tipe: "MULTI",
      kode_mapel: code,
      soal: "Bacalah teks berikut, lalu jawab pertanyaannya. ...",
    }),
    example({
      no: 7,
      tipe: "ESSAY",
      soal: "Apa gagasan utama teks tersebut?",
      kunci_essay: "...",
      poin: 2,
      induk: 6,
    }),
    example({
      no: 8,
      tipe: "ESSAY",
      soal: "Sebutkan dua tokoh dalam teks.",
      kunci_essay: "...",
      poin: 2,
      induk: 6,
    }),
  ]);
  ws["!cols"] = HEADERS.map((h) => ({
    wch: h === "soal" || h === "kunci_essay" || h === "pasangan" ? 40 : 12,
  }));

  const guide = [
    ["kolom", "isi"],
    ["no", "Nomor urut unik di file (angka)"],
    [
      "tipe",
      "PG, BS, ISIAN, JODOH, ESSAY, MULTI. Sub-soal MULTI: ESSAY atau kosong",
    ],
    [
      "kode_mapel",
      "Kode mapel sekolah (lihat sheet Mapel). Sub-soal boleh kosong (ikut induk)",
    ],
    ["soal", "Teks soal. MULTI: teks pengantar"],
    [
      "gambar",
      "Opsional. Nama file gambar di ZIP (contoh soal1.png), JPG/PNG/WebP maks 2 MB",
    ],
    [
      "opsi_a … opsi_e",
      "PG: 2–5 opsi berurutan dari opsi_a. Opsi gambar: img:nama.png",
    ],
    [
      "kunci",
      "PG: huruf opsi (A–E). BS: B (benar) / S (salah). ISIAN: jawaban, pisahkan dengan |",
    ],
    ["pasangan", "JODOH: kiri=kanan, pisahkan dengan | (2–10 pasangan)"],
    ["kunci_essay", "ESSAY & sub-soal: jawaban acuan (wajib)"],
    [
      "kata_kunci",
      "ESSAY & sub-soal: kata kunci, pisahkan dengan koma (maks 20)",
    ],
    ["poin", "Bobot soal, kosong = 1. MULTI: diabaikan (jumlah poin sub-soal)"],
    ["induk", "Sub-soal: No soal MULTI induknya (2–20 sub-soal per MULTI)"],
    ["pembahasan", "Opsional"],
    [
      "",
      `Maksimal ${MAX_ROWS} baris per file. Satu error = seluruh file tidak disimpan.`,
    ],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Soal");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["kode_mapel", "nama"],
      ...subjects.map((s) => [s.code, s.name]),
    ]),
    "Mapel",
  );
  const guideWs = XLSX.utils.aoa_to_sheet(guide);
  guideWs["!cols"] = [{ wch: 16 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, guideWs, "Petunjuk");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
