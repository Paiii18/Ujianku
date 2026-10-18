import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import type { ApiBody } from "@/lib/api";
import { requireApiRole } from "@/lib/apiAuth";
import {
  readQuestionRows,
  validateQuestionRows,
  type ImportQuestion,
} from "@/lib/questionImport";
import type { Json } from "@/types/database";

// Unggah gambar ZIP ke Storage satu per satu bisa lama untuk ratusan soal bergambar
export const config = { maxDuration: 60 };

const MAX_IMAGE = 2 * 1024 * 1024; // batas bucket question-images
const BATCH = 10; // ponytail: 10 unggahan paralel; naikkan bila import terasa lambat
const IMAGE_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const bodySchema = z.object({
  path: z.string().min(1).max(300),
  zipPath: z.string().min(1).max(300).nullable(),
  fileName: z.string().min(1).max(200),
  commit: z.boolean(),
});

export type PreviewRow = Pick<
  ImportQuestion,
  "row" | "no" | "parentNo" | "type" | "content" | "errors"
>;
export type ImportResult = { preview: PreviewRow[] } | { imported: number };

// POST { path, zipPath, fileName, commit }: file .xlsx/.csv (+ .zip gambar) sudah diunggah browser
// ke bucket imports (DEC-001). commit=false → pratinjau + error per baris. commit=true → validasi
// ulang, unggah gambar ZIP ke question-images/{tenant}/{id soal}/, lalu import_questions() satu
// transaksi. Gagal = gambar yang sudah diunggah dihapus. Setiap commit dicatat di import_jobs.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiBody<ImportResult>>,
) {
  const supabase = await requireApiRole(req, res, "POST", "teacher");
  if (!supabase) return;

  const body = bodySchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Data tidak valid" });
  const { path, zipPath, fileName, commit } = body.data;

  // Diunduh dengan sesi user: policy storage hanya mengizinkan folder {tenant}/{user} sendiri
  const [{ data: sheet }, zipBlob] = await Promise.all([
    supabase.storage.from("imports").download(path),
    zipPath ? supabase.storage.from("imports").download(zipPath) : null,
  ]);
  if (!sheet || (zipPath && !zipBlob?.data)) {
    return res.status(404).json({ error: "File tidak ditemukan" });
  }

  const read = readQuestionRows(await sheet.arrayBuffer());
  if ("error" in read) return res.status(400).json({ error: read.error });

  let zip: JSZip | null = null;
  if (zipBlob?.data) {
    try {
      zip = await JSZip.loadAsync(await zipBlob.data.arrayBuffer());
    } catch {
      return res.status(400).json({ error: "File ZIP tidak bisa dibaca." });
    }
  }

  const [{ data: subjects }, { data: tenantId }] = await Promise.all([
    supabase.from("subjects").select("id, code"),
    supabase.rpc("my_tenant"),
  ]);
  if (!tenantId) return res.status(403).json({ error: "Akses ditolak" });

  const rows = validateQuestionRows(read.rows, {
    subjects: new Map(
      (subjects ?? []).map((s) => [s.code.toLowerCase(), s.id]),
    ),
  });
  const images = await readZipImages(rows, zip);

  const errorRows = rows.filter((r) => r.errors.length);
  if (!commit || errorRows.length) {
    if (!commit) {
      const preview = rows.map(
        ({ row, no, parentNo, type, content, errors }) => ({
          row,
          no,
          parentNo,
          type,
          content: content.slice(0, 200),
          errors,
        }),
      );
      return res.status(200).json({ data: { preview } });
    }
    await supabase.from("import_jobs").insert({
      file_name: fileName,
      status: "failed",
      total_rows: rows.length,
      errors: errorRows.map((r) => ({ row: r.row, errors: r.errors })),
      finished_at: new Date().toISOString(),
    });
    return res.status(400).json({
      error: "Masih ada baris yang error. Perbaiki file lalu unggah ulang.",
    });
  }

  // id soal dibuat di sini agar gambar bisa diunggah ke foldernya sebelum soal disimpan (F2.8)
  const uploads: { path: string; data: Uint8Array }[] = [];
  const upload = (id: string, name: string, file: string | null) => {
    if (!file) return null;
    const target = `${tenantId}/${id}/${name}.${extOf(file)}`;
    uploads.push({ path: target, data: images.get(file.toLowerCase())! });
    return target;
  };
  const payload = rows
    .filter((q) => q.parentNo === null)
    .map((q) => {
      const id = randomUUID();
      return {
        row: q.row,
        id,
        subject_id: q.subjectId,
        type: q.type,
        content: q.content,
        image_path: upload(id, "soal", q.image),
        points: q.points,
        explanation: q.explanation,
        options: q.options.map((o) => ({
          label: o.label,
          content: o.content,
          image_path: upload(id, `opsi-${o.label.toLowerCase()}`, o.image),
          is_correct: o.isCorrect,
        })),
        answers: q.answers,
        pairs: q.pairs,
        answer_key: q.answerKey,
        keywords: q.keywords,
        subs: rows
          .filter((s) => s.parentNo !== null && s.parentNo === q.no)
          .map((s) => ({
            content: s.content,
            answer_key: s.answerKey,
            keywords: s.keywords,
            points: s.points,
          })),
      };
    });

  const { data: job } = await supabase
    .from("import_jobs")
    .insert({ file_name: fileName, total_rows: rows.length })
    .select("id")
    .single();
  const finishJob = (fields: {
    status: "success" | "failed";
    imported_count?: number;
    errors?: { row: number; errors: string[] }[];
  }) =>
    job
      ? supabase
          .from("import_jobs")
          .update({ ...fields, finished_at: new Date().toISOString() })
          .eq("id", job.id)
      : null;
  const storage = supabase.storage.from("question-images");
  const cleanup = () =>
    uploads.length ? storage.remove(uploads.map((u) => u.path)) : null;

  for (let i = 0; i < uploads.length; i += BATCH) {
    const results = await Promise.all(
      uploads.slice(i, i + BATCH).map((u) =>
        storage.upload(u.path, u.data, {
          contentType: IMAGE_MIME[extOf(u.path)],
        }),
      ),
    );
    if (results.some((r) => r.error)) {
      console.error("import upload", results.find((r) => r.error)?.error);
      await cleanup();
      await finishJob({
        status: "failed",
        errors: [{ row: 0, errors: ["Gagal mengunggah gambar"] }],
      });
      return res.status(500).json({
        error: "Gagal mengunggah gambar. Tidak ada soal yang disimpan.",
      });
    }
  }

  const { data: imported, error } = await supabase.rpc("import_questions", {
    p_questions: payload as unknown as Json,
  });
  if (error) {
    await cleanup();
    // 22023 = pesan validasi save_question ("Baris 4: ..."), aman ditampilkan
    const message =
      error.code === "22023" ? error.message : "Gagal menyimpan soal";
    if (error.code !== "22023") console.error("import_questions", error);
    await finishJob({
      status: "failed",
      errors: [{ row: 0, errors: [message] }],
    });
    return res.status(error.code === "22023" ? 400 : 500).json({
      error: `${message}. Tidak ada soal yang disimpan.`,
    });
  }

  await finishJob({ status: "success", imported_count: imported ?? 0 });
  await supabase.storage
    .from("imports")
    .remove(zipPath ? [path, zipPath] : [path]);
  return res.status(201).json({ data: { imported: imported ?? 0 } });
}

// Cek gambar yang dirujuk ada di ZIP (dicocokkan nama file tanpa folder, tanpa beda huruf
// besar/kecil) dan ≤ 2 MB. Error ditambahkan ke baris; isi file dikembalikan per nama (huruf kecil).
async function readZipImages(rows: ImportQuestion[], zip: JSZip | null) {
  const entries = new Map<string, JSZip.JSZipObject>();
  zip?.forEach((p, entry) => {
    const name = p.split("/").pop()!.toLowerCase();
    if (!entry.dir && name && !p.startsWith("__MACOSX/"))
      entries.set(name, entry);
  });

  const data = new Map<string, Uint8Array>();
  for (const q of rows) {
    const refs = [
      q.image && { label: "Gambar", file: q.image },
      ...q.options.map(
        (o) => o.image && { label: `Opsi ${o.label}`, file: o.image },
      ),
    ].filter((r): r is { label: string; file: string } => !!r);
    for (const { label, file } of refs) {
      const key = file.toLowerCase();
      if (!zip) {
        q.errors.push(`${label}: ${file} butuh file ZIP gambar`);
        continue;
      }
      if (!data.has(key)) {
        const entry = entries.get(key);
        // File rusak di dalam ZIP diperlakukan sama dengan tidak ada
        const bytes = entry
          ? await readLimited(entry, MAX_IMAGE).catch(() => undefined)
          : undefined;
        if (bytes === undefined) {
          q.errors.push(`${label}: ${file} tidak ada di ZIP atau rusak`);
          continue;
        }
        if (bytes === null) {
          q.errors.push(`${label}: ${file} lebih dari 2 MB`);
          continue;
        }
        data.set(key, bytes);
      }
    }
  }
  return data;
}

// Ekstrak satu file ZIP, berhenti bila melebihi batas (ZIP kecil bisa berisi file raksasa).
function readLimited(entry: JSZip.JSZipObject, max: number) {
  return new Promise<Uint8Array | null>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    const stream = entry.nodeStream("nodebuffer");
    stream
      .on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > max) {
          stream.pause();
          resolve(null);
        } else chunks.push(chunk);
      })
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function extOf(file: string) {
  return file.split(".").pop()!.toLowerCase();
}
