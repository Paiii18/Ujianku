import * as XLSX from "xlsx";
import { headerIndex, readGrid } from "./spreadsheet";

// Import murid dari Excel / CSV (F2.4). SheetJS hanya dipakai di API Route (AGENTS.md §2).
// Dua tahap murni (tanpa I/O) agar bisa diuji: baca sheet → validasi dengan data sekolah.

export const MAX_ROWS = 500;
const HEADERS = ["nis", "nama", "kelas", "password"] as const;

export type RawStudentRow = {
  row: number; // nomor baris di Excel (header = baris 1)
  nis: string;
  fullName: string;
  className: string;
  password: string;
};
export type StudentRow = RawStudentRow & {
  classId: string | null;
  errors: string[];
};

export function readStudentRows(
  file: ArrayBuffer,
): { rows: RawStudentRow[] } | { error: string } {
  const read = readGrid(file, MAX_ROWS);
  if ("error" in read) return read;
  const head = headerIndex(read.grid[0], HEADERS);
  if ("error" in head) return head;

  const cell = (r: string[], h: (typeof HEADERS)[number]) =>
    (r[head.col[h]] ?? "").trim();
  const rows = read.grid
    .slice(1)
    .map((r, i) => ({
      row: i + 2,
      nis: cell(r, "nis"),
      fullName: cell(r, "nama"),
      className: cell(r, "kelas"),
      password: cell(r, "password"),
    }))
    .filter((r) => r.nis || r.fullName || r.className || r.password);

  if (rows.length === 0) return { error: "File tidak berisi data murid." };
  if (rows.length > MAX_ROWS) {
    return { error: `Maksimal ${MAX_ROWS} murid per file.` };
  }
  return { rows };
}

// classes: nama kelas (huruf kecil) → id, hanya tahun ajaran aktif.
// takenNis: NIS/NIP yang sudah dipakai akun mana pun di sekolah ini.
export function validateStudentRows(
  rows: RawStudentRow[],
  ctx: { classes: Map<string, string>; takenNis: Set<string> },
): StudentRow[] {
  const firstRowOf = new Map<string, number>();
  return rows.map((r) => {
    const errors: string[] = [];
    if (!/^\d{1,20}$/.test(r.nis)) {
      errors.push("NIS wajib, hanya angka (maks. 20 digit)");
    } else if (ctx.takenNis.has(r.nis)) {
      errors.push("NIS sudah terdaftar");
    } else if (firstRowOf.has(r.nis)) {
      errors.push(`NIS sama dengan baris ${firstRowOf.get(r.nis)}`);
    } else {
      firstRowOf.set(r.nis, r.row);
    }
    if (!r.fullName) errors.push("Nama wajib diisi");
    else if (r.fullName.length > 100) errors.push("Nama maksimal 100 karakter");
    if (r.password.length < 8) errors.push("Password minimal 8 karakter");
    else if (r.password.length > 72)
      errors.push("Password maksimal 72 karakter");

    const classId = r.className
      ? (ctx.classes.get(r.className.toLowerCase()) ?? null)
      : null;
    if (r.className && !classId) {
      errors.push(`Kelas "${r.className}" tidak ada di tahun ajaran aktif`);
    }
    return { ...r, classId, errors };
  });
}

// Template: sheet "Murid" (kolom NIS berformat teks agar nol di depan tidak hilang)
// + sheet "Kelas" berisi nama kelas tahun ajaran aktif sebagai rujukan.
export function buildStudentTemplate(classNames: string[]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    [...HEADERS],
    ["2026001", "Contoh Nama Murid", classNames[0] ?? "", "Rahasia123"],
  ]);
  for (let r = 1; r <= MAX_ROWS + 1; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: 0 });
    ws[ref] ??= { t: "s", v: "" };
    ws[ref].z = "@";
  }
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: MAX_ROWS + 1, c: 3 },
  });
  ws["!cols"] = [{ wch: 14 }, { wch: 32 }, { wch: 14 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Murid");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["kelas (tahun ajaran aktif)"],
      ...classNames.map((n) => [n]),
    ]),
    "Kelas",
  );
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// BOM agar Excel membuka file sebagai UTF-8; pemisah koma (bila Excel berlokal Indonesia
// menyimpan ulang dengan titik koma, tetap terbaca).
export function studentCsvTemplate(className = "") {
  return `\uFEFF${HEADERS.join(",")}\r\n2026001,Contoh Nama Murid,${className},Rahasia123\r\n`;
}
