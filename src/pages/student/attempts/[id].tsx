import { useEffect, useSyncExternalStore } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import ExamRunner from "@/components/student/ExamRunner";
import { readSession, type Paper } from "@/lib/examPaper";
import { checkStudentExamAccess } from "@/lib/requireRole";
import { createClient } from "@/lib/supabase/server";

type Props =
  | { paper: Paper; images: Record<string, string>; serverNow: number }
  | { closed: string };

const UUID = /^[0-9a-f-]{36}$/i;

// Halaman pengerjaan ujian (F3.8). Soal dari RPC get_exam_questions (tanpa kunci, F3.7);
// gambar ditandatangani dengan sesi murid (policy Storage F3.7). Tidak memakai AppShell agar
// fokus, dan tetap bisa dibuka saat masa tenggang (profil tidak terbaca, DEC-044).
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const supabase = createClient(ctx.req, ctx.res);
  const denied = await checkStudentExamAccess(supabase);
  if (denied) return denied;

  const id = String(ctx.params?.id ?? "");
  if (!UUID.test(id)) return { notFound: true };

  const { data, error } = await supabase.rpc("get_exam_questions", {
    p_attempt_id: id,
  });
  if (error || !data) {
    // 22023 = waktu habis / sudah dikumpulkan / tidak ditemukan — aman ditampilkan
    return {
      props: {
        closed: error?.code === "22023" ? error.message : "Ujian gagal dimuat.",
      },
    };
  }
  const paper = data as unknown as Paper;

  const paths = paper.questions
    .flatMap((q) => [q.image_path, ...q.options.map((o) => o.image_path)])
    .filter((p): p is string => !!p);
  // Berlaku sampai batas waktu + 10 menit
  const expiresIn =
    Math.ceil((new Date(paper.deadline_at).getTime() - Date.now()) / 1000) +
    600;
  const { data: signed } = paths.length
    ? await supabase.storage
        .from("question-images")
        .createSignedUrls(paths, expiresIn)
    : { data: [] };
  const images = Object.fromEntries(
    (signed ?? []).flatMap((s) =>
      s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [],
    ),
  );

  return { props: { paper, images, serverNow: Date.now() } };
};

const noop = () => () => {};

export default function AttemptPage(props: Props) {
  const router = useRouter();
  const paper = "paper" in props ? props.paper : null;
  // true hanya di browser setelah hydration: soal dirender di klien saja karena butuh
  // localStorage (sesi, ragu-ragu) & jam perangkat
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const hasSession = mounted && !!paper && !!readSession(paper.attempt_id);

  // Perangkat tanpa session_id attempt ini → masuk lagi dengan token (sesi diputar, DEC-003)
  useEffect(() => {
    if (mounted && paper && !hasSession) {
      void router.replace(`/student/exams/${paper.exam_id}`);
    }
  }, [mounted, paper, hasSession, router]);

  if ("closed" in props) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Head>
          <title>Ujian · Ujianku</title>
        </Head>
        <p className="text-lg font-semibold">{props.closed}</p>
        <Link
          href="/student/exams"
          className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
        >
          Kembali ke daftar ujian
        </Link>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <Head>
          <title>Ujian · Ujianku</title>
        </Head>
        <p className="text-muted-foreground">Memuat ujian…</p>
      </main>
    );
  }

  return (
    <ExamRunner
      paper={props.paper}
      images={props.images}
      serverNow={props.serverNow}
    />
  );
}
