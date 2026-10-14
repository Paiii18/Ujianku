# AGENTS.md — Website Ujian Sekolah

Aturan untuk AI coding agent (Claude Code, Codex, Cursor, dll.) di repo ini.
Sumber kebenaran fitur: `docs/PRD.md`. Skema DB: `supabase/schema.sql` + `supabase/migrations/`. Data dummy: `supabase/seed.sql`.
Jika instruksi di file ini bertentangan dengan PRD, **berhenti dan tanyakan**, jangan menebak.

---

## 1. Ringkasan proyek

SaaS ujian online multi-tenant: banyak sekolah, langganan per bulan, nonaktif otomatis saat masa aktif habis.
Peran: `super_admin` (platform), `school_admin`, `teacher`, `student` (terikat satu `tenant_id`).
6 tipe soal: PG, Benar/Salah, Isian, Menjodohkan, Essay, Multi Essay. Penilaian otomatis di server.

## 2. Tech stack (jangan diganti tanpa persetujuan)

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js **Pages Router** (`/pages`) + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS |
| DB / Auth / Storage | Supabase (PostgreSQL, RLS, Storage) |
| Server logic | API Routes `/pages/api` + Postgres function (RPC) |
| Excel | SheetJS (`xlsx`), hanya di API Route |
| Penjadwal | `pg_cron` |
| Deploy | Vercel + Supabase Cloud (tahap awal: **free tier**) |

- **Jangan** memakai App Router (`/app`), Server Actions, atau `next/navigation`. Gunakan `next/router`, `getServerSideProps`, dan API Routes.
- Client Supabase: `@supabase/ssr` (`createBrowserClient` di browser, `createServerClient` di API Route / `getServerSideProps` / `src/proxy.ts`).
- Validasi input di API Route dengan `zod`.
- Jangan menambah dependency baru tanpa menyebutkan alasannya di ringkasan perubahan.

## 3. Perintah

```bash
npm run dev          # jalankan lokal
npm run build        # wajib lolos sebelum menyatakan selesai
npm run lint
npm run typecheck    # tsc --noEmit
npx supabase start               # Supabase lokal
npx supabase db reset            # terapkan migrasi + seed.sql
npx supabase migration new <nama>
npx supabase gen types typescript --local > src/types/database.ts
```

Sesuaikan bagian ini bila script di `package.json` berubah.

## 4. Struktur folder

```
src/
  pages/
    api/                 # API Routes (server only)
    admin/  school/  teacher/  student/   # halaman per peran
    login.tsx  subscription-expired.tsx
  components/ui/         # komponen shadcn (hasil generate, jangan diedit manual kecuali perlu)
  components/<fitur>/    # komponen per fitur
  lib/supabase/          # browser.ts, server.ts, admin.ts (service_role)
  lib/                   # helper umum
  types/database.ts      # hasil generate, jangan diedit manual
  proxy.ts               # Next 16: pengganti middleware.ts — cek sesi + status langganan + peran
supabase/
  migrations/  schema.sql  seed.sql
docs/PRD.md  docs/architecture.md
```

## 5. Aturan WAJIB (keamanan & multi-tenant)

1. **Setiap tabel data sekolah** punya `tenant_id`, `ENABLE ROW LEVEL SECURITY`, dan policy yang memakai `my_tenant()` + `tenant_is_active()`. Tabel baru tanpa RLS = tidak boleh di-merge.
2. **Jangan pernah** mempercayai `tenant_id`, `role`, atau `student_id` dari body request. Ambil dari sesi (`auth.uid()` → `profiles`).
3. `SUPABASE_SECRET_KEY` (secret key, pengganti service_role) hanya di `lib/supabase/admin.ts` dan hanya dipakai di API Route. Tidak boleh ada di kode client atau variabel `NEXT_PUBLIC_*`. Setiap pemakaian service_role wajib memfilter `tenant_id` secara eksplisit.
4. **Kunci jawaban tidak pernah dikirim ke murid.** Murid mengambil soal hanya lewat RPC `get_exam_questions()`. Jangan `select('*')` tabel `questions`, `question_options`, `question_pairs` dari sisi murid.
5. **Penilaian hanya di server** lewat RPC `submit_attempt()` / `recalc_attempt()`. Client tidak pernah menghitung atau mengirim nilai.
6. **Waktu dari server.** `deadline_at` dihitung di DB; jawaban setelah batas ditolak di RPC, bukan hanya di UI.
7. Operasi multi-langkah (import Excel, remedial, ujian ulang, kenaikan kelas, pembayaran) dijalankan dalam **satu RPC / satu transaksi**.
8. Perubahan nilai, ujian ulang, dan langganan **wajib** tercatat di `audit_logs`.
9. Data tidak pernah dihapus permanen untuk attempt/nilai: gunakan `is_voided`, `is_active`, status.
10. Storage: bucket `question-images`, path `{tenant_id}/...`, akses lewat signed URL.

## 6. Database & migrasi

- Semua perubahan skema lewat file baru di `supabase/migrations/`. **Jangan mengedit migrasi yang sudah diterapkan.**
- Setelah migrasi: jalankan `db reset`, lalu generate ulang `types/database.ts`.
- Penamaan: tabel & kolom `snake_case` jamak (`exam_attempts`), enum `snake_case`, RPC berbentuk kata kerja (`open_remedial`).
- RPC yang perlu melewati RLS memakai `SECURITY DEFINER` + `SET search_path = public` + cek peran/tenant di awal fungsi.
- Tambahkan index untuk setiap foreign key dan kolom yang dipakai di policy RLS (`tenant_id`).
- Ingat batas free tier Supabase (DB, Storage, bandwidth): kompres gambar di browser (maks 2 MB), hindari query tanpa pagination.

## 7. Konvensi TypeScript & Next.js

- `strict: true`. Dilarang `any`; gunakan tipe dari `types/database.ts`.
- Komponen: PascalCase, satu komponen per file. Hook: `useXxx`. Helper: camelCase.
- API Route: cek method → cek sesi → cek peran → validasi zod → panggil RPC/query → kembalikan `{ data }` atau `{ error }` dengan status HTTP yang tepat.
- Proteksi halaman per peran di `src/proxy.ts` **dan** di `getServerSideProps`; RLS tetap pengaman terakhir.
- Pesan error untuk user dalam Bahasa Indonesia; jangan bocorkan detail error DB ke client.

## 8. UI

- Pakai komponen shadcn/ui yang sudah ada sebelum membuat komponen baru. Tambah komponen dengan `npx shadcn@latest add <nama>`.
- Styling hanya Tailwind; tidak ada file CSS per komponen.
- Teks antarmuka Bahasa Indonesia. Responsif (murid sering memakai HP).
- Halaman ujian murid: fokus performa (< 2 detik), auto-save debounce ±1 detik, tahan koneksi putus (antre lalu kirim ulang).

## 9. Testing & verifikasi

Sebelum menyatakan tugas selesai:

1. `npm run typecheck`, `npm run lint`, `npm run build` lolos.
2. Untuk perubahan DB/RLS: uji dengan akun seed bahwa **user sekolah A tidak bisa membaca/menulis data sekolah B**, dan user sekolah nonaktif tidak bisa mengakses apa pun.
3. Untuk fitur murid: pastikan respons API tidak memuat kunci jawaban.
4. Sebutkan cara menguji manual (akun seed, langkah klik). Semua akun seed: `Password123!`.

## 10. Alur kerja agent

- Kerjakan sesuai fase di Roadmap PRD; jangan mengerjakan fitur fase berikutnya tanpa diminta.
- Untuk tugas besar: tulis rencana singkat (file yang diubah, migrasi, risiko) sebelum menulis kode.
- Perubahan kecil dan terfokus; jangan refactor file yang tidak terkait.
- Jangan membuat keputusan atas **pertanyaan terbuka PRD** (harga langganan, apakah Admin Sekolah boleh membuat soal). Tanyakan.
- Akhiri setiap tugas dengan ringkasan: apa yang diubah, migrasi baru, dependency baru, cara uji.

## 11. Tentang developer

Developer berlatar Java + MySQL dan sedang belajar TypeScript, Supabase, dan Next.js Pages Router.
Saat memperkenalkan pola yang belum ada di repo (RLS policy, RPC, generic TS, `getServerSideProps`), beri penjelasan singkat dalam Bahasa Indonesia; analogi ke Java/MySQL boleh dipakai bila membantu.

## 12. Dilarang

- Menonaktifkan RLS atau membuat policy `using (true)` pada tabel data sekolah.
- Commit file `.env*` atau key apa pun.
- Menghitung nilai, timer, atau validasi token hanya di client.
- Menghapus data attempt/nilai secara permanen.
- Mengubah `components/ui/` atau `types/database.ts` secara manual tanpa alasan.
- Menulis kode App Router.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
