import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { callApi } from "@/lib/api";
import { requireRole, type ShellProps } from "@/lib/requireRole";
import { createClient } from "@/lib/supabase/browser";
import type {
  ImportResult,
  PreviewRow,
} from "@/pages/api/school/students/import";

// Content-Type ditetapkan sendiri: browser kadang melaporkan .csv sebagai application/vnd.ms-excel
const MIME = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
} as const;

type Props = ShellProps & { folder: string };

export const getServerSideProps = requireRole(
  "school_admin",
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

export default function ImportStudentsPage({ user, folder }: Props) {
  const router = useRouter();
  const [path, setPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "save" | null>(null);

  const errorRows = preview?.filter((r) => r.errors.length).length ?? 0;

  async function onFile(file: File | undefined) {
    setPreview(null);
    setPath(null);
    setError(null);
    if (!file) return;
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "xlsx" && ext !== "csv") {
      setError("File harus berformat .xlsx atau .csv");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran file maksimal 5 MB");
      return;
    }

    setBusy("upload");
    // Unggah langsung ke Storage (DEC-001), API Route hanya menerima path-nya
    const target = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await createClient()
      .storage.from("imports")
      .upload(target, file, { contentType: MIME[ext] });
    if (uploadError) {
      setBusy(null);
      setError("Gagal mengunggah file. Coba lagi.");
      return;
    }
    const body = await callApi<ImportResult>(
      "/api/school/students/import",
      "POST",
      { path: target, commit: false },
    );
    setBusy(null);
    if ("error" in body) {
      setError(body.error);
      return;
    }
    if ("preview" in body.data) {
      setPreview(body.data.preview);
      setPath(target);
    }
  }

  async function save() {
    if (!path) return;
    setBusy("save");
    setError(null);
    const body = await callApi<ImportResult>(
      "/api/school/students/import",
      "POST",
      { path, commit: true },
    );
    setBusy(null);
    if ("error" in body) {
      setError(body.error);
      return;
    }
    if ("imported" in body.data) {
      toast.success(`${body.data.imported} murid berhasil diimport`);
      await router.push("/school/students");
    }
  }

  return (
    <AppShell user={user} title="Import murid">
      <div className="flex flex-col gap-4">
        <Link
          href="/school/students"
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Daftar murid
        </Link>

        <ol className="flex list-decimal flex-col gap-2 rounded-lg border bg-card p-4 pl-8 text-sm">
          <li>
            Unduh template (.xlsx atau .csv), isi kolom <b>nis</b>, <b>nama</b>,{" "}
            <b>kelas</b> (opsional, nama kelas di tahun ajaran aktif — daftarnya
            ada di sheet &ldquo;Kelas&rdquo; template .xlsx), dan{" "}
            <b>password</b> awal (min. 8 karakter). CSV boleh dipisah koma atau
            titik koma.
          </li>
          <li>Unggah file. Periksa pratinjau dan perbaiki baris yang error.</li>
          <li>
            Simpan. Bila ada satu baris error, <b>tidak ada</b> murid yang
            disimpan. Maksimal 500 murid per file.
          </li>
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" asChild>
            <a href="/api/school/students/template" download>
              <Download aria-hidden /> Template .xlsx
            </a>
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <a href="/api/school/students/template?format=csv" download>
              <Download aria-hidden /> Template .csv
            </a>
          </Button>
          <Button className="h-11" asChild disabled={busy !== null}>
            <label className="cursor-pointer">
              <FileUp aria-hidden />
              {busy === "upload"
                ? "Memeriksa file..."
                : "Pilih file .xlsx / .csv"}
              <input
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="sr-only"
                disabled={busy !== null}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = ""; // pilih file yang sama lagi tetap memicu onChange
                }}
              />
            </label>
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
                {preview.length} baris dibaca.{" "}
                {errorRows > 0 ? (
                  <span className="font-medium text-destructive">
                    {errorRows} baris error — perbaiki file lalu unggah ulang.
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
                  : `Simpan ${preview.length} murid`}
              </Button>
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Baris</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kelas</TableHead>
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
                        <TableCell className="font-mono">{r.nis}</TableCell>
                        <TableCell className="min-w-40">{r.fullName}</TableCell>
                        <TableCell>{r.className || "—"}</TableCell>
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
