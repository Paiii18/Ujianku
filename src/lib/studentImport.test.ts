import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  MAX_ROWS,
  buildStudentTemplate,
  readStudentRows,
  validateStudentRows,
} from "./studentImport";

function xlsx(rows: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Murid");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const ctx = {
  classes: new Map([["x ipa 1", "class-1"]]),
  takenNis: new Set(["999"]),
};

describe("readStudentRows", () => {
  it("membaca baris, melewati baris kosong, nomor baris sesuai Excel", () => {
    const res = readStudentRows(
      xlsx([
        ["NIS", "Nama", "Kelas", "Password"],
        ["001", " Ani ", "X IPA 1", "Rahasia123"],
        [],
        [1002, "Budi", "", "Rahasia123"],
      ]),
    );
    expect(res).toEqual({
      rows: [
        {
          row: 2,
          nis: "001",
          fullName: "Ani",
          className: "X IPA 1",
          password: "Rahasia123",
        },
        {
          row: 4,
          nis: "1002",
          fullName: "Budi",
          className: "",
          password: "Rahasia123",
        },
      ],
    });
  });

  it("kolom hilang, file kosong, file rusak, terlalu banyak baris", () => {
    expect(readStudentRows(xlsx([["nis", "nama"]]))).toEqual({
      error: "Kolom kelas, password tidak ditemukan. Gunakan template.",
    });
    expect(
      readStudentRows(xlsx([["nis", "nama", "kelas", "password"]])),
    ).toHaveProperty("error");
    expect(
      readStudentRows(new TextEncoder().encode("bukan excel").buffer),
    ).toHaveProperty("error");
    const many = Array.from({ length: MAX_ROWS + 1 }, (_, i) => [
      String(i),
      "A",
      "",
      "Rahasia123",
    ]);
    expect(
      readStudentRows(xlsx([["nis", "nama", "kelas", "password"], ...many])),
    ).toEqual({
      error: `Maksimal ${MAX_ROWS} murid per file.`,
    });
  });

  it("template hasil buildStudentTemplate bisa dibaca ulang", () => {
    const buf = buildStudentTemplate(["X IPA 1"]);
    const res = readStudentRows(new Uint8Array(buf).buffer);
    expect(res).toEqual({
      rows: [
        {
          row: 2,
          nis: "2026001",
          fullName: "Contoh Nama Murid",
          className: "X IPA 1",
          password: "Rahasia123",
        },
      ],
    });
  });
});

describe("readStudentRows (CSV)", () => {
  const csv = (text: string) => new TextEncoder().encode(text).buffer;
  const expected = {
    rows: [
      {
        row: 2,
        nis: "0012",
        fullName: "Siti Nur'aini Çelik",
        className: "X IPA 1",
        password: "Rahasia123",
      },
      {
        row: 3,
        nis: "0013",
        fullName: "Budi, S",
        className: "",
        password: "Rahasia;123",
      },
    ],
  };

  it("koma, nol di depan NIS tetap, UTF-8 dengan BOM, sel berkutip", () => {
    expect(
      readStudentRows(
        csv(
          '\uFEFFnis,nama,kelas,password\r\n0012,Siti Nur\'aini Çelik,X IPA 1,Rahasia123\r\n0013,"Budi, S",,Rahasia;123\r\n',
        ),
      ),
    ).toEqual(expected);
  });

  it("titik koma (CSV Excel berlokal Indonesia)", () => {
    expect(
      readStudentRows(
        csv(
          'nis;nama;kelas;password\n0012;Siti Nur\'aini Çelik;X IPA 1;Rahasia123\n0013;Budi, S;;"Rahasia;123"\n',
        ),
      ),
    ).toEqual(expected);
  });

  it('CSV Windows-1252 (Excel "CSV" biasa)', () => {
    const bytes = Uint8Array.from(
      [
        ..."nis,nama,kelas,password\n0012,Siti Nur'aini \u00c7elik,X IPA 1,Rahasia123\n",
      ].map((c) => c.charCodeAt(0)),
    );
    expect(readStudentRows(bytes.buffer)).toEqual({ rows: [expected.rows[0]] });
  });
});

describe("validateStudentRows", () => {
  const base = { fullName: "Ani", className: "", password: "Rahasia123" };

  it("baris valid: kelas di-resolve tanpa beda huruf besar/kecil", () => {
    const [r] = validateStudentRows(
      [{ ...base, row: 2, nis: "1", className: "X IPA 1" }],
      ctx,
    );
    expect(r).toMatchObject({ classId: "class-1", errors: [] });
  });

  it("menandai setiap jenis error", () => {
    const rows = validateStudentRows(
      [
        { ...base, row: 2, nis: "12a" },
        { ...base, row: 3, nis: "999" },
        { ...base, row: 4, nis: "5" },
        {
          ...base,
          row: 5,
          nis: "5",
          fullName: "",
          password: "pendek",
          className: "XII Z",
        },
      ],
      ctx,
    );
    expect(rows.map((r) => r.errors)).toEqual([
      ["NIS wajib, hanya angka (maks. 20 digit)"],
      ["NIS sudah terdaftar"],
      [],
      [
        "NIS sama dengan baris 4",
        "Nama wajib diisi",
        "Password minimal 8 karakter",
        'Kelas "XII Z" tidak ada di tahun ajaran aktif',
      ],
    ]);
  });
});
