import Head from "next/head";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Ditampilkan proxy (rewrite, status 403) saat peran tidak cocok dengan prefix URL.
export default function ForbiddenPage() {
  return (
    <>
      <Head>
        <title>Akses ditolak · Ujianku</title>
      </Head>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <ShieldX className="size-12 text-destructive" aria-hidden />
        <h1 className="text-2xl font-semibold">Akses ditolak</h1>
        <p className="max-w-sm text-muted-foreground">
          Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
        <Button asChild className="h-11">
          {/* /login mengarahkan user yang sudah masuk ke dashboard-nya */}
          <Link href="/login">Kembali ke dashboard</Link>
        </Button>
      </main>
    </>
  );
}
