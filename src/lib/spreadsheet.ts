import * as XLSX from "xlsx";

// Baca sheet pertama .xlsx / .csv menjadi grid teks (dipakai import murid & soal).
// SheetJS hanya dipakai di API Route (AGENTS.md §2).
export function readGrid(
  file: ArrayBuffer,
  maxRows: number,
): { grid: string[][] } | { error: string } {
  let wb: XLSX.WorkBook;
  try {
    const bytes = new Uint8Array(file);
    // .xlsx = arsip ZIP ("PK"); selain itu dianggap CSV dan didekode sendiri,
    // karena SheetJS membaca CSV tanpa BOM sebagai Latin-1 (huruf non-ASCII rusak).
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    // raw: sel CSV tetap teks (NIS "0012" tidak jadi angka 12)
    // sheetRows: berhenti membaca setelah batas (header + maxRows + 1 untuk deteksi kelebihan)
    const opts = { dense: true, raw: true, sheetRows: maxRows + 2 };
    wb = isZip
      ? XLSX.read(bytes, { ...opts, type: "array" })
      : XLSX.read(decodeText(bytes), { ...opts, type: "string" });
  } catch {
    return {
      error: "File tidak bisa dibaca. Pastikan formatnya .xlsx atau .csv.",
    };
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { error: "File tidak berisi sheet." };

  // header: 1 → array per baris; raw: false → teks sesuai tampilan sel (angka tetap utuh)
  const grid = XLSX.utils
    .sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    })
    .map((r) => r.map((c) => String(c ?? "")));
  return { grid };
}

// CSV "UTF-8" (Excel modern, Google Sheets) atau CSV biasa Excel Windows (Windows-1252).
function decodeText(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes); // BOM dibuang otomatis
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

// Cari indeks kolom wajib dari baris header (tanpa beda huruf besar/kecil).
export function headerIndex<H extends string>(
  headerRow: string[] | undefined,
  headers: readonly H[],
): { col: Record<H, number> } | { error: string } {
  const header = (headerRow ?? []).map((h) => h.trim().toLowerCase());
  const col = Object.fromEntries(
    headers.map((h) => [h, header.indexOf(h)]),
  ) as Record<H, number>;
  const missing = headers.filter((h) => col[h] < 0);
  if (missing.length) {
    return {
      error: `Kolom ${missing.join(", ")} tidak ditemukan. Gunakan template.`,
    };
  }
  return { col };
}
