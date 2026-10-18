import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { callApi } from "@/lib/api";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import { requireRole, type ShellProps } from "@/lib/requireRole";
import { createClient } from "@/lib/supabase/browser";
import type {
  ImportResult,
  PreviewRow,
} from "@/pages/api/teacher/questions/import";

// Content-Type ditetapkan sendiri: browser kadang melaporkan .csv sebagai application/vnd.ms-excel
// dan .zip sebagai application/x-zip-compressed
const MIME: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  zip: "application/zip",
};
const MAX_FILE = 5 * 1024 * 1024; // batas bucket imports

type Props = ShellProps & { folder: string };
type Uploaded = { path: string; zipPath: string | null; fileName: string };

export const getServerSideProps = requireRole(
  "teacher",
  async (_ctx, supabase) => {
    const [{ data: claims }, { data: tenantId }] = await Promise.all([
      supabase.auth.getClaims(),
      supabase.rpc("my_tenant"),
    ]);
    if (!claims?.claims || !tenantId) return null;
    // Folder upload sesuai policy storage bucket imports: {tenant_id}/{user_id}
    return { folder: `${tenantId}/${claims.claims.sub}` };
  },
);

export default function ImportQuestionsPage({ user, folder }: Props) {
  const router = useRouter();
  const [sheet, setSheet] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"check" | "save" | null>(null);

  const errorRows = preview?.filter((r) => r.errors.length).length ?? 0;
  const questionCount = preview?.filter((r) => r.parentNo === null).length ?? 0;

  function pick(setter: (f: File | null) => void, file: File | undefined) {
    setter(file ?? null);
    setPreview(null);
    setUploaded(null);
    setError(null);
  }

  async function upload(file: File) {
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    const target = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await createClient()
      .storage.from("imports")
      .upload(target, file, { contentType: MIME[ext] });
    return uploadError ? null : target;
  }

  async function check() {
    if (!sheet) return;
    setError(null);
    const ext = sheet.name.toLowerCase().split(".").pop();
    if (ext !== "xlsx" && ext !== "csv") {
      return setError("File soal harus berformat .xlsx atau .csv");
    }
    if (zip && !zip.name.toLowerCase().endsWith(".zip")) {
      return setError("File gambar harus berformat .zip");
    }
    if (sheet.size > MAX_FILE || (zip && zip.size > MAX_FILE)) {
      return setError("Ukuran setiap file maksimal 5 MB");
    }

    setBusy("check");
    // Unggah langsung ke Storage (DEC-001), API Route hanya menerima path-nya
    const [path, zipPath] = await Promise.all([
      upload(sheet),
      zip ? upload(zip) : null,
    ]);
    if (!path || (zip && !zipPath)) {
      setBusy(null);
      return setError("Gagal mengunggah file. Coba lagi.");
    }
    const target = { path, zipPath, fileName: sheet.name };
    const body = await callApi<ImportResult>(
      "/api/teacher/questions/import",
      "POST",
      { ...target, commit: false },
    );
    setBusy(null);
    if ("error" in body) return setError(body.error);
    if ("preview" in body.data) {
      setPreview(body.data.preview);
      setUploaded(target);
    }
  }

  async function save() {
    if (!uploaded) return;
    setBusy("save");
    setError(null);
    const body = await callApi<ImportResult>(
      "/api/teacher/questions/import",
      "POST",
      { ...uploaded, commit: true },
    );
    setBusy(null);
    if ("error" in body) return setError(body.error);
    if ("imported" in body.data) {
      toast.success(`${body.data.imported} soal berhasil diimport`);
      await router.push("/teacher/questions");
    }
  }

  return (
    <AppShell user={user} title="Import soal">
      <div className="flex flex-col gap-4">
        <Link
          href="/teacher/questions"
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Bank soal
        </Link>

        <ol className="flex list-decimal flex-col gap-2 rounded-lg border bg-card p-4 pl-8 text-sm">
          <li>
            Unduh template, isi satu baris per soal. Arti tiap kolom ada di
            sheet &ldquo;Petunjuk&rdquo;, kode mapel di sheet
            &ldquo;Mapel&rdquo;.
          </li>
          <li>
            Soal bergambar: tulis nama file di kolom <b>gambar</b> (atau{" "}
            <b>img:nama.png</b> di kolom opsi), lalu kumpulkan semua gambar
            (JPG/PNG/WebP, maks. 2 MB per gambar) dalam satu file .zip.
          </li>
          <li>Periksa file. Perbaiki baris yang error, lalu periksa ulang.</li>
          <li>
            Simpan. Bila ada satu baris error, <b>tidak ada</b> soal yang
            disimpan. Maksimal 500 baris per file.
          </li>
        </ol>

        <Button variant="outline" className="h-11 w-fit" asChild>
          <a href="/api/teacher/questions/template" download>
            <Download aria-hidden /> Template .xlsx
          </a>
        </Button>

        <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="sheet">File soal (.xlsx / .csv)</FieldLabel>
            <Input
              id="sheet"
              type="file"
              className="h-11"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={busy !== null}
              onChange={(e) => pick(setSheet, e.target.files?.[0])}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="zip">Gambar (.zip, opsional)</FieldLabel>
            <Input
              id="zip"
              type="file"
              className="h-11"
              accept=".zip,application/zip"
              disabled={busy !== null}
              onChange={(e) => pick(setZip, e.target.files?.[0])}
            />
            <FieldDescription>Maks. 5 MB per file.</FieldDescription>
          </Field>
          <Button
            className="h-11 sm:col-span-2 sm:w-fit"
            disabled={!sheet || busy !== null}
            onClick={check}
          >
            {busy === "check" ? "Memeriksa file..." : "Periksa file"}
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {preview && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm" aria-live="polite">
                {preview.length} baris dibaca ({questionCount} soal).{" "}
                {errorRows > 0 ? (
                  <span className="font-medium text-destructive">
                    {errorRows} baris error — perbaiki file lalu periksa ulang.
                  </span>
                ) : (
                  <span className="font-medium text-success">
                    Semua baris valid.
                  </span>
                )}
              </p>
              <Button
                className="h-11"
                disabled={errorRows > 0 || busy !== null}
                onClick={save}
              >
                {busy === "save"
                  ? "Menyimpan..."
                  : `Simpan ${questionCount} soal`}
              </Button>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Baris</TableHead>
                    <TableHead>No</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead>Soal</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Baris error ditampilkan lebih dulu */}
                  {[...preview]
                    .sort(
                      (a, b) =>
                        b.errors.length - a.errors.length || a.row - b.row,
                    )
                    .map((r) => (
                      <TableRow
                        key={r.row}
                        className={
                          r.errors.length ? "bg-destructive/5" : undefined
                        }
                      >
                        <TableCell>{r.row}</TableCell>
                        <TableCell>{r.no ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.parentNo !== null
                            ? `Sub-soal no ${r.parentNo}`
                            : r.type
                              ? QUESTION_TYPE_LABEL[r.type]
                              : "—"}
                        </TableCell>
                        <TableCell className="max-w-72 min-w-48 truncate">
                          {r.content}
                        </TableCell>
                        <TableCell className="min-w-48">
                          {r.errors.length ? (
                            <ul className="text-destructive">
                              {r.errors.map((e) => (
                                <li key={e}>{e}</li>
                              ))}
                            </ul>
                          ) : (
                            <Badge className="bg-success text-success-foreground">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
