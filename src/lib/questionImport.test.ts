import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  MAX_ROWS,
  buildQuestionTemplate,
  readQuestionRows,
  validateQuestionRows,
  type RawQuestionRow,
} from "./questionImport";

const HEADER = [
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
];

function xlsx(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Soal");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const ctx = {
  subjects: new Map([
    ["mtk", "subj-mtk"],
    ["ipa", "subj-ipa"],
  ]),
};

let rowNo = 1;
function raw(values: Partial<RawQuestionRow>): RawQuestionRow {
  const r = { row: ++rowNo } as RawQuestionRow;
  for (const h of HEADER) (r as Record<string, string>)[h] = "";
  return { ...r, kode_mapel: "MTK", soal: "Soal?", ...values };
}
const validate = (...rows: Partial<RawQuestionRow>[]) =>
  validateQuestionRows(rows.map(raw), ctx);

describe("readQuestionRows", () => {
  it("membaca baris, melewati baris kosong, nomor baris sesuai Excel", () => {
    const res = readQuestionRows(
      xlsx([
        HEADER.map((h) => h.toUpperCase()),
        [1, "PG", "MTK", " Soal 1 ", "", 96, 86, "", "", "", "A"],
        [],
        [2, "BS", "MTK", "Soal 2", "", "", "", "", "", "", "B"],
      ]),
    );
    expect("rows" in res && res.rows.map((r) => [r.row, r.no, r.soal])).toEqual(
      [
        [2, "1", "Soal 1"],
        [4, "2", "Soal 2"],
      ],
    );
  });

  it("menolak kolom hilang, file kosong, dan lebih dari batas", () => {
    expect(readQuestionRows(xlsx([["no", "tipe"]]))).toEqual({
      error: expect.stringContaining("kode_mapel"),
    });
    expect(readQuestionRows(xlsx([HEADER]))).toEqual({
      error: "File tidak berisi soal.",
    });
    const many = Array.from({ length: MAX_ROWS + 1 }, (_, i) => [i + 1, "BS"]);
    expect(readQuestionRows(xlsx([HEADER, ...many]))).toEqual({
      error: `Maksimal ${MAX_ROWS} soal per file.`,
    });
  });

  it("template terbaca ulang dan lolos validasi", () => {
    const file = buildQuestionTemplate([{ code: "MTK", name: "Matematika" }]);
    const res = readQuestionRows(new Uint8Array(file).buffer);
    if (!("rows" in res)) throw new Error(res.error);
    const qs = validateQuestionRows(res.rows, ctx);
    expect(qs.flatMap((q) => q.errors)).toEqual([]);
    expect(qs.map((q) => q.type)).toEqual([
      "multiple_choice",
      "true_false",
      "short_answer",
      "matching",
      "essay",
      "multi_essay",
      "essay",
      "essay",
    ]);
  });
});

describe("validateQuestionRows", () => {
  it("baris umum: no, tipe, mapel, soal, poin", () => {
    const [ok, bad, dup] = validate(
      { no: "1", tipe: "bs", kunci: "s", poin: "1,5" },
      { no: "x", tipe: "UJI", kode_mapel: "BIO", soal: "", poin: "0" },
      { no: "1", tipe: "BS", kunci: "B", kode_mapel: "" },
    );
    expect(ok.errors).toEqual([]);
    expect(ok).toMatchObject({
      subjectId: "subj-mtk",
      points: 1.5,
      type: "true_false",
    });
    expect(ok.options.map((o) => [o.content, o.isCorrect])).toEqual([
      ["Benar", false],
      ["Salah", true],
    ]);
    expect(bad.errors).toEqual([
      "No wajib berupa angka bulat positif",
      "Tipe wajib PG, BS, ISIAN, JODOH, ESSAY, atau MULTI",
      'Kode mapel "BIO" tidak dikenal',
      "Soal wajib diisi",
      "Poin harus lebih dari 0 (maks 1.000)",
    ]);
    expect(dup.errors).toEqual([
      `No sama dengan baris ${ok.row}`,
      "Kode mapel wajib diisi",
    ]);
  });

  it("PG: opsi berurutan, kunci di opsi terisi, opsi gambar", () => {
    const [ok, short, gap, badKey] = validate(
      {
        no: "1",
        tipe: "PG",
        opsi_a: "96",
        opsi_b: "img:b.PNG",
        opsi_c: "108",
        kunci: "c",
        gambar: "soal1.jpg",
      },
      { no: "2", tipe: "PG", opsi_a: "96", kunci: "A" },
      { no: "3", tipe: "PG", opsi_a: "1", opsi_c: "3", kunci: "A" },
      {
        no: "4",
        tipe: "PG",
        opsi_a: "1",
        opsi_b: "2",
        opsi_c: "img:x.gif",
        kunci: "D",
      },
    );
    expect(ok.errors).toEqual([]);
    expect(ok.image).toBe("soal1.jpg");
    expect(ok.options).toEqual([
      { label: "A", content: "96", image: null, isCorrect: false },
      { label: "B", content: "", image: "b.PNG", isCorrect: false },
      { label: "C", content: "108", image: null, isCorrect: true },
    ]);
    expect(short.errors).toEqual([
      "Soal PG harus punya minimal 2 opsi (opsi_a, opsi_b)",
    ]);
    expect(gap.errors).toEqual([
      "Opsi PG harus berurutan dari opsi_a tanpa ada yang kosong",
    ]);
    expect(badKey.errors).toEqual([
      "Kunci PG harus huruf salah satu opsi yang diisi (A–E)",
      "Opsi C: isi nama file JPG/PNG/WebP di ZIP",
    ]);
  });

  it("BS & gambar: kunci B/S, URL gambar & path folder ditolak", () => {
    const [empty, url, folder] = validate(
      { no: "1", tipe: "BS", kunci: "" },
      {
        no: "2",
        tipe: "BS",
        kunci: "Benar",
        gambar: "https://contoh.id/a.png",
      },
      { no: "3", tipe: "BS", kunci: "B", gambar: "../a.png" },
    );
    expect(empty.errors).toEqual(["Kunci BS harus B (benar) atau S (salah)"]);
    expect(url.errors).toEqual([
      "Gambar: URL belum didukung, masukkan gambar ke file ZIP",
    ]);
    expect(folder.errors).toEqual([
      "Gambar: isi nama file JPG/PNG/WebP di ZIP",
    ]);
  });

  it("ISIAN: jawaban dipisah |, kosong & kembar ditolak", () => {
    const [ok, empty, dup] = validate(
      { no: "1", tipe: "ISIAN", kunci: " Jakarta | DKI  Jakarta ||" },
      { no: "2", tipe: "ISIAN", kunci: "" },
      { no: "3", tipe: "ISIAN", kunci: "Jakarta|jakarta" },
    );
    expect(ok.errors).toEqual([]);
    expect(ok.answers).toEqual(["Jakarta", "DKI  Jakarta"]);
    expect(empty.errors).toEqual([
      "Kunci isian harus berisi 1–10 jawaban, pisahkan dengan |",
    ]);
    expect(dup.errors).toEqual(["Ada jawaban isian yang sama"]);
  });

  it("JODOH: kiri=kanan, 2–10 pasangan, sisi tidak kembar", () => {
    const [ok, one, noEq, dup] = validate(
      {
        no: "1",
        tipe: "JODOH",
        pasangan: "Jakarta = Indonesia|Tokyo=Jepang|1+1=2=dua",
      },
      { no: "2", tipe: "JODOH", pasangan: "Jakarta=Indonesia" },
      { no: "3", tipe: "JODOH", pasangan: "Jakarta=Indonesia|Tokyo" },
      { no: "4", tipe: "JODOH", pasangan: "A=1|B=1" },
    );
    expect(ok.errors).toEqual([]);
    expect(ok.pairs).toEqual([
      { left: "Jakarta", right: "Indonesia" },
      { left: "Tokyo", right: "Jepang" },
      { left: "1+1", right: "2=dua" },
    ]);
    expect(one.errors).toEqual([
      "Pasangan harus berisi 2–10 pasangan kiri=kanan, pisahkan dengan |",
    ]);
    expect(noEq.errors).toEqual(["Setiap pasangan harus berbentuk kiri=kanan"]);
    expect(dup.errors).toEqual([
      "Teks di sisi kiri maupun kanan tidak boleh sama",
    ]);
  });

  it("ESSAY: kunci essay wajib, kata kunci dirapikan & maks 20", () => {
    const [ok, empty, many] = validate(
      {
        no: "1",
        tipe: "ESSAY",
        kunci_essay: "Acuan",
        kata_kunci: " klorofil, Cahaya,,cahaya ",
      },
      { no: "2", tipe: "ESSAY" },
      {
        no: "3",
        tipe: "ESSAY",
        kunci_essay: "Acuan",
        kata_kunci: Array.from({ length: 21 }, (_, i) => `k${i}`).join(","),
      },
    );
    expect(ok.errors).toEqual([]);
    expect(ok.keywords).toEqual(["klorofil", "Cahaya"]);
    expect(empty.errors).toEqual(["Kunci essay (jawaban acuan) wajib diisi"]);
    expect(many.errors).toEqual([
      "Maksimal 20 kata kunci, masing-masing 50 karakter",
    ]);
  });

  it("MULTI: sub-soal lewat induk, mewarisi mapel, 2–20 sub-soal", () => {
    const [parent, sub1, sub2, lonely, orphan, wrongParent, badSub] = validate(
      { no: "1", tipe: "MULTI", kode_mapel: "IPA", poin: "99" },
      {
        no: "2",
        tipe: "",
        kode_mapel: "",
        kunci_essay: "a",
        poin: "2",
        induk: "1",
      },
      { no: "3", tipe: "ESSAY", kode_mapel: "", kunci_essay: "b", induk: "1" },
      { no: "4", tipe: "MULTI" },
      { no: "5", tipe: "ESSAY", kunci_essay: "c", induk: "9" },
      {
        no: "6",
        tipe: "ESSAY",
        kunci_essay: "c",
        induk: "4",
        kode_mapel: "IPA",
        gambar: "x.png",
        pembahasan: "p",
      },
      { no: "7", tipe: "PG", kode_mapel: "", kunci_essay: "c", induk: "1" },
    );
    expect(parent.errors).toEqual([]);
    expect(parent.points).toBe(0);
    expect(
      [sub1, sub2].map((s) => [
        s.errors,
        s.type,
        s.subjectId,
        s.parentNo,
        s.points,
      ]),
    ).toEqual([
      [[], "essay", "subj-ipa", 1, 2],
      [[], "essay", "subj-ipa", 1, 1],
    ]);
    expect(lonely.errors).toEqual([
      "Soal MULTI harus punya 2–20 sub-soal (ada 1)",
    ]);
    expect(orphan.errors).toEqual(["Induk 9 bukan soal MULTI di file ini"]);
    expect(wrongParent.errors).toEqual([
      "Sub-soal tidak bisa diberi gambar",
      "Pembahasan sub-soal tidak didukung; tulis di soal induk",
      "Kode mapel sub-soal harus sama dengan induk",
    ]);
    expect(badSub.errors).toEqual(["Tipe sub-soal harus ESSAY"]);
  });
});
