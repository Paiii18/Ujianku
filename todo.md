# TODO — Pelacak Progres Website Ujian Sekolah

File ini adalah **memori proyek**. Agent dan developer wajib membacanya di awal sesi dan memperbaruinya setiap kali status tugas berubah.
Rujukan: `docs/PRD.md` (fitur) · `docs/architecture.md` (detail tugas & kriteria selesai) · `AGENTS.md` (aturan coding).

---

## Cara pakai

**Status**

| Simbol | Arti |
| --- | --- |
| ⬜ | Belum mulai |
| 🟦 | Sedang dikerjakan |
| 🟨 | Review / menunggu uji manual |
| ✅ | Selesai (semua kriteria selesai + DoD umum terpenuhi) |
| ⛔ | Terblokir (tulis alasan di kolom Catatan + tabel Blocker) |

**Aturan update**

1. Awal sesi: baca bagian **Sedang dikerjakan**, **Blocker**, dan 5 entri terakhir **Log**.
2. Mulai tugas: ubah status ke 🟦, isi **Sedang dikerjakan**.
3. Tugas selesai: ubah ke ✅ **hanya jika** semua kriteria di `architecture.md` terpenuhi; isi kolom PR; perbarui **Ringkasan**; tambah entri **Log**.
4. Temukan bug/masalah di luar tugas: catat sebagai `ISS-xxx` di **Issue**, jangan langsung diperbaiki kecuali kecil dan terkait.
5. Ambil keputusan teknis yang tidak ada di PRD/architecture: catat sebagai `DEC-xxx`.
6. Jangan menghapus baris; ubah status. Log hanya ditambah (terbaru di atas).
7. Tanggal format `YYYY-MM-DD`.

---

## Ringkasan

| Fase | Total | ✅ | 🟦 | 🟨 | ⛔ | Progres |
| --- | --- | --- | --- | --- | --- | --- |
| F0 Persiapan | 6 | 4 | 0 | 1 | 0 | 67% |
| F1 Fondasi multi-tenant | 12 | 0 | 0 | 0 | 0 | 0% |
| F2 Struktur sekolah & bank soal | 14 | 0 | 0 | 0 | 0 | 0% |
| F3 Ujian & penilaian | 15 | 0 | 0 | 0 | 0 | 0% |
| F4 Remedial, ujian ulang, report | 11 | 0 | 0 | 0 | 1 | 0% |
| F5 Pengembangan lanjutan | 3 | 0 | 0 | 0 | 0 | 0% |
| **Total** | **61** | **4** | **0** | **1** | **1** | **7%** |

## Sedang dikerjakan

| ID | Tugas | Mulai | Langkah berikutnya |
| --- | --- | --- | --- |
| F0.5 | CI GitHub Actions | 2026-10-14 | Developer push, cek tab Actions hijau, lalu ubah ke ✅ |

---

## F0 — Persiapan proyek

| ID | Tugas | Status | Bergantung | PR | Catatan |
| --- | --- | --- | --- | --- | --- |
| F0.1 | Inisialisasi repo Next.js (Pages Router, TS strict, Tailwind) | ✅ | — | | Next.js 16.4, React 19, Tailwind 4 |
| F0.2 | Setup shadcn/ui & layout dasar | ✅ | F0.1 | | Preset radix-nova; toast→sonner, form→field (DEC-005) |
| F0.3 | Setup Supabase lokal & cloud | ✅ | F0.1 | | Cloud ref `vvjazxdyollfnrtbpifs` (ap-southeast-1), sudah di-link |
| F0.4 | Client Supabase (browser, server, admin) | ✅ | F0.3 | | Guard admin: lint no-restricted-imports + cek window; halaman uji /dev/auth-check |
| F0.5 | CI GitHub Actions | 🟨 | F0.1, F0.3 | | Workflow siap; menunggu developer push & cek status hijau di GitHub |
| F0.6 | Deploy awal Vercel | ⬜ | F0.4 | | |

## F1 — Fondasi multi-tenant

| ID | Tugas | Status | Bergantung | PR | Catatan |
| --- | --- | --- | --- | --- | --- |
| F1.1 | Migrasi enum, `tenants`, `subscriptions`, `profiles` | ⬜ | F0.3 | | |
| F1.2 | Fungsi helper RLS (`my_tenant`, `my_role`, `tenant_is_active`) | ⬜ | F1.1 | | |
| F1.3 | Policy RLS tabel fondasi + tes pgTAP | ⬜ | F1.2 | | |
| F1.4 | Seed fondasi | ⬜ | F1.1 | | |
| F1.5 | Login staf & login murid | ⬜ | F0.4, F1.4 | | |
| F1.6 | Proxy (`src/proxy.ts`, eks-middleware) sesi, peran, langganan | ⬜ | F1.5 | | |
| F1.7 | Layout & dashboard kosong per peran | ⬜ | F1.6, F0.2 | | |
| F1.8 | Super Admin: kelola sekolah | ⬜ | F1.7 | | |
| F1.9 | Super Admin: langganan & `mark_payment_paid` | ⬜ | F1.8 | | Nominal harga menunggu Q-001 |
| F1.10 | Job `pg_cron` cek langganan harian | ⬜ | F1.9 | | |
| F1.11 | Halaman "Langganan berakhir" & status Admin Sekolah | ⬜ | F1.6 | | |
| F1.12 | Dashboard Super Admin | ⬜ | F1.9 | | |

## F2 — Struktur sekolah & bank soal

| ID | Tugas | Status | Bergantung | PR | Catatan |
| --- | --- | --- | --- | --- | --- |
| F2.1 | Migrasi struktur sekolah + RLS | ⬜ | F1.3 | | |
| F2.2 | Tahun ajaran & mapel | ⬜ | F2.1 | | |
| F2.3 | Akun guru & murid (manual) | ⬜ | F2.1 | | |
| F2.4 | Import murid dari Excel | ⬜ | F2.3, F2.5 | | |
| F2.5 | Kelas & wali kelas | ⬜ | F2.2, F2.3 | | |
| F2.6 | Penugasan guru | ⬜ | F2.5 | | |
| F2.7 | Migrasi bank soal + RLS | ⬜ | F2.1 | | Policy Admin Sekolah menunggu Q-002 |
| F2.8 | Storage gambar soal | ⬜ | F2.7 | | |
| F2.9 | Editor soal: PG & Benar/Salah | ⬜ | F2.8 | | |
| F2.10 | Editor soal: Isian & Menjodohkan | ⬜ | F2.9 | | |
| F2.11 | Editor soal: Essay & Multi Essay | ⬜ | F2.9 | | |
| F2.12 | Daftar bank soal | ⬜ | F2.9 | | |
| F2.13 | Template & parser import soal Excel | ⬜ | F2.7 | | |
| F2.14 | Import soal: upload, preview, simpan | ⬜ | F2.13, F2.8 | | |

## F3 — Ujian & penilaian

| ID | Tugas | Status | Bergantung | PR | Catatan |
| --- | --- | --- | --- | --- | --- |
| F3.1 | Migrasi ujian + RLS | ⬜ | F2.7 | | |
| F3.2 | Trigger peserta ujian | ⬜ | F3.1 | | |
| F3.3 | Wizard buat ujian (guru) | ⬜ | F3.2, F2.12 | | |
| F3.4 | Token ujian | ⬜ | F3.3 | | |
| F3.5 | Preview ujian (guru) | ⬜ | F3.3 | | |
| F3.6 | Daftar ujian murid | ⬜ | F3.2 | | |
| F3.7 | RPC `start_attempt` & `get_exam_questions` | ⬜ | F3.4 | | |
| F3.8 | Halaman ujian: tampilan & navigasi | ⬜ | F3.7 | | |
| F3.9 | Auto-save & lanjutkan sesi | ⬜ | F3.8 | | |
| F3.10 | Fullscreen & pindah tab | ⬜ | F3.8 | | |
| F3.11 | RPC `submit_attempt` — penilaian otomatis | ⬜ | F3.9 | | |
| F3.12 | Monitoring ujian (guru) | ⬜ | F3.7 | | |
| F3.13 | Antrean koreksi essay | ⬜ | F3.11 | | |
| F3.14 | Publikasi nilai & halaman nilai murid | ⬜ | F3.13 | | |
| F3.15 | Uji beban 40 murid serentak | ⬜ | F3.11 | | |

## F4 — Remedial, ujian ulang, report, notifikasi

| ID | Tugas | Status | Bergantung | PR | Catatan |
| --- | --- | --- | --- | --- | --- |
| F4.1 | RPC `open_remedial` | ⬜ | F3.14 | | |
| F4.2 | Pengajuan ujian ulang | ⬜ | F3.11 | | |
| F4.3 | RPC `decide_retake` | ⬜ | F4.2 | | |
| F4.4 | Notifikasi dalam aplikasi (UI) | ⬜ | F3.3 | | |
| F4.5 | Report per ujian (guru) | ⬜ | F3.14 | | |
| F4.6 | Analisis butir soal | ⬜ | F4.5 | | |
| F4.7 | Report sekolah (Admin Sekolah) | ⬜ | F4.5 | | |
| F4.8 | Kenaikan kelas | ⬜ | F2.5 | | |
| F4.9 | Ekspor rapor (Excel & PDF) | ⛔ | F4.7 | | Menunggu contoh format rapor (B-001) |
| F4.10 | Audit log viewer | ⬜ | F3.13 | | |
| F4.11 | Hardening sebelum rilis | ⬜ | semua F1–F4 | | Termasuk pindah hosting komersial (Q-003) |

## F5 — Pengembangan lanjutan

| ID | Tugas | Status | Bergantung | PR | Catatan |
| --- | --- | --- | --- | --- | --- |
| F5.1 | Payment gateway (Midtrans/Xendit) | ⬜ | F1.9 | | |
| F5.2 | Penilaian essay semantik | ⬜ | F3.11 | | |
| F5.3 | Paket langganan & masa trial | ⬜ | F1.10 | | Menunggu Q-001 |

---

## Blocker

| ID | Menghambat | Penyebab | Butuh dari | Status |
| --- | --- | --- | --- | --- |
| B-001 | F4.9 | Belum ada contoh format rapor | Sekolah pertama | Terbuka |

## Pertanyaan terbuka

| ID | Pertanyaan | Berdampak ke | Jawaban | Status |
| --- | --- | --- | --- | --- |
| Q-001 | Harga per bulan & diskon 6/12 bulan? | F1.9, F5.3 | | Terbuka |
| Q-002 | Admin Sekolah boleh membuat soal & ujian? | F2.7, F3.3 | | Terbuka |
| Q-003 | Hosting komersial: Vercel Pro atau alternatif? | F4.11 | | Terbuka |

## Issue

Format: bug, utang teknis, atau temuan di luar tugas berjalan.

| ID | Judul | Tipe | Prioritas | Terkait | Status | Dibuat | Catatan |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | bug / tech-debt / ide | tinggi / sedang / rendah | ID tugas | Terbuka / Selesai | | |

## Keputusan teknis

Keputusan yang tidak tertulis di PRD/architecture, agar tidak diperdebatkan ulang.

| ID | Tanggal | Keputusan | Alasan | Terkait |
| --- | --- | --- | --- | --- |
| DEC-001 | 2026-10-13 | Upload Excel/ZIP langsung dari browser ke Storage, bukan lewat API Route | Batas body request Vercel ±4,5 MB | F2.4, F2.14 |
| DEC-002 | 2026-10-13 | Monitoring ujian memakai polling 10 detik, bukan Realtime | Lebih sederhana, hemat kuota free tier | F3.12 |
| DEC-003 | 2026-10-13 | Satu sesi aktif per murid lewat `session_id` yang diputar di `start_attempt` | Mencegah ujian dikerjakan di dua perangkat | F3.7, F3.9 |
| DEC-004 | 2026-10-14 | Next.js 16 (versi terbaru create-next-app) dengan Pages Router; `next dev` otomatis menambahkan blok `nextjs-agent-rules` di akhir AGENTS.md, dibiarkan | Versi stabil terbaru; blok akan selalu ditulis ulang bila dihapus | F0.1 |
| DEC-005 | 2026-10-14 | shadcn: `sonner` pengganti `toast`, `field` pengganti `form` (keduanya deprecated di shadcn terbaru); `react-hook-form` dipasang saat form pertama (F1.5); font sistem (tanpa Geist); `.next/dev` di-exclude dari tsconfig | Ikuti registry shadcn terbaru; hindari dependency/unduhan font yang belum perlu; `.next/dev/types` dan `.next/types` bentrok saat `tsc` | F0.2 |
| DEC-006 | 2026-10-14 | Pengecekan sesi/peran/langganan di `src/proxy.ts` (fungsi `proxy`), bukan `middleware.ts`; dokumen dipindah ke `docs/` | Next 16 men-deprecate `middleware` dan menggantinya dengan `proxy` (runtime Node.js); dengan folder `src/` file harus di `src/` | F1.6 |
| DEC-007 | 2026-10-14 | Supabase CLI sebagai devDependency (`npx supabase`); nama env `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (diganti developer dari `..._ANON_KEY`) / `SUPABASE_SECRET_KEY` (diganti developer dari `SUPABASE_SERVICE_ROLE_KEY`), diisi publishable / secret key format baru | CLI versi terkunci per repo; supabase-js menerima kedua format key, nama env konsisten dengan AGENTS.md | F0.3, F0.4 |
| DEC-008 | 2026-10-14 | Proteksi `admin.ts` dari kode client memakai ESLint `no-restricted-imports` (hanya boleh dari `src/pages/api`) + throw bila `window` ada, bukan paket `server-only` | `server-only` dirancang untuk App Router (kondisi react-server), tidak cocok untuk Pages Router; lint memberi error lebih awal | F0.4 |

---

## Log

Terbaru di atas. Format: `YYYY-MM-DD · ID · ringkasan · file/migrasi penting`.

- 2026-10-14 · F0.5 · Workflow CI: npm ci, supabase start (layanan minimal), typecheck, lint, build, db reset, pgTAP (dilewati bila belum ada tes) · .github/workflows/ci.yml
- 2026-10-14 · F0.4 · Client Supabase browser/server(req,res)/admin, types/database.ts (skema kosong), ESLint larang import admin di luar src/pages/api, halaman uji /dev/auth-check; build OK, service key tidak ada di bundle client · src/lib/supabase/, eslint.config.mjs
- 2026-10-14 · F0.3 · Project cloud `ujianku` dibuat ulang di Singapura (ap-southeast-1, ref vvjazxdyollfnrtbpifs; project Sydney dihapus) dan di-link; koneksi DB remote OK · supabase/.temp (diabaikan git)
- 2026-10-14 · F0.3 · Supabase lokal: supabase init + start (Postgres 17), .env.example, .env.local, .gitignore !.env.example; cloud menunggu · supabase/config.toml
- 2026-10-14 · — · PRD & architecture dipindah ke docs/ (PRD → docs/PRD.md); rujukan middleware.ts → src/proxy.ts di AGENTS.md & architecture.md · DEC-006
- 2026-10-14 · F0.2 · shadcn/ui (radix-nova) + button, input, field, card, table, dialog, sonner, dropdown-menu, badge, tabs, label; Toaster di _app; halaman contoh; tsconfig exclude .next/dev · components.json, src/components/ui/, src/pages/_app.tsx
- 2026-10-14 · F0.1 · Scaffold Next.js 16.4 Pages Router (src/, TS strict, Tailwind 4, ESLint, Prettier), script typecheck & format, git init · package.json, src/pages/
- 2026-10-13 · — · Dokumen awal dibuat: PRD, AGENTS.md, CLAUDE.md, architecture.md, todo.md
