import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";

// Gambar soal (bucket privat question-images, DEC-030).

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIDE = 1600; // px, sisi terpanjang setelah kompres
const MAX_BYTES = 2 * 1024 * 1024; // batas bucket

// Kompres di browser dengan canvas (tanpa library): perkecil ke 1600 px lalu simpan WebP 80%.
// Browser yang tidak bisa membuat WebP (Safari lama) jatuh ke PNG; blob.type yang menentukan.
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
      "image/webp",
      0.8,
    ),
  );
}

// Unggah ke {folder}/{acak}.{ext}; folder = `${tenantId}/${questionId}`. Mengembalikan path & URL pratinjau.
export async function uploadQuestionImage(
  folder: string,
  file: File,
): Promise<{ path: string; previewUrl: string } | { error: string }> {
  if (!IMAGE_TYPES.includes(file.type)) {
    return { error: "Gambar harus JPG, PNG, atau WebP" };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { error: "File gambar terlalu besar (maks. 20 MB sebelum kompres)" };
  }
  let blob: Blob;
  try {
    blob = await compress(file);
  } catch {
    return { error: "Gambar tidak bisa dibaca" };
  }
  if (blob.size > MAX_BYTES) {
    return { error: "Gambar masih lebih dari 2 MB setelah dikompres" };
  }
  const ext = blob.type === "image/webp" ? "webp" : "png";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient()
    .storage.from("question-images")
    .upload(path, blob, { contentType: blob.type });
  if (error) return { error: "Gagal mengunggah gambar. Coba lagi." };
  return { path, previewUrl: URL.createObjectURL(blob) };
}

// Signed URL untuk ditampilkan (server, sesi user). Path yang gagal ditandatangani dilewati.
export async function signQuestionImages(
  supabase: SupabaseClient<Database>,
  paths: (string | null)[],
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return {};
  const { data } = await supabase.storage
    .from("question-images")
    .createSignedUrls(unique, 60 * 60);
  return Object.fromEntries(
    (data ?? [])
      .filter((d) => d.path && d.signedUrl)
      .map((d) => [d.path as string, d.signedUrl as string]),
  );
}
