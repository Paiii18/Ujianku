-- Data dummy lokal (dijalankan otomatis oleh `npx supabase db reset`).
-- JANGAN dijalankan di cloud/produksi. Semua akun: Password123!
--
-- Sekolah:
--   SMAN1BDG — aktif (masa aktif 30 hari lagi)
--   SMPN2JKT — langganan habis (nonaktif sejak kemarin)
--
-- Akun staf (login tab Staf, email):
--   superadmin@ujianku.test           super_admin
--   admin@sman1bdg.test               school_admin  SMAN1BDG
--   admin@smpn2jkt.test               school_admin  SMPN2JKT
--   guru.matematika@sman1bdg.test     teacher       SMAN1BDG
--   guru.biologi@sman1bdg.test        teacher       SMAN1BDG
--   guru.ipa@smpn2jkt.test            teacher       SMPN2JKT
-- Akun murid (login tab Murid: kode sekolah + NIS):
--   SMAN1BDG NIS 2026001–2026006, SMPN2JKT NIS 2026101–2026102
--   (email sintetis: <nis>@<kode huruf kecil>.siswa.local)
-- Struktur (F2.1): tahun ajaran, 3 mapel, 3 kelas, 5 penugasan guru — lihat bagian Fase 2.

-- Fase 1: fondasi --------------------------------------------------------------

insert into public.tenants (id, code, name, status, active_until) values
  ('a0000000-0000-0000-0000-000000000001', 'SMAN1BDG', 'SMA Negeri 1 Bandung', 'active', now() + interval '30 days'),
  ('a0000000-0000-0000-0000-000000000002', 'SMPN2JKT', 'SMP Negeri 2 Jakarta', 'inactive', now() - interval '1 day');

insert into public.subscriptions (tenant_id, period_start, period_end, amount, status, paid_at) values
  ('a0000000-0000-0000-0000-000000000001', current_date - 30, current_date - 1, 500000, 'paid', now() - interval '30 days'),
  ('a0000000-0000-0000-0000-000000000001', current_date - 1, current_date + 30, 500000, 'paid', now() - interval '1 day'),
  ('a0000000-0000-0000-0000-000000000002', current_date - 32, current_date - 1, 500000, 'paid', now() - interval '32 days');

-- Membuat user Auth yang bisa login dengan password (meniru yang dilakukan GoTrue saat signUp).
-- Kolom token wajib '' (bukan NULL), kalau tidak GoTrue gagal membaca baris user.
create function pg_temp.seed_user(uid uuid, mail text) returns void language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (uid::text, uid, json_build_object('sub', uid::text, 'email', mail, 'email_verified', true), 'email', now(), now(), now());
$$;

select pg_temp.seed_user(id, email) from (values
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'superadmin@ujianku.test'),
  ('b0000000-0000-0000-0000-000000000011', 'admin@sman1bdg.test'),
  ('b0000000-0000-0000-0000-000000000012', 'admin@smpn2jkt.test'),
  ('b0000000-0000-0000-0000-000000000021', 'guru.matematika@sman1bdg.test'),
  ('b0000000-0000-0000-0000-000000000022', 'guru.biologi@sman1bdg.test'),
  ('b0000000-0000-0000-0000-000000000023', 'guru.ipa@smpn2jkt.test'),
  ('b0000000-0000-0000-0000-000000000031', '2026001@sman1bdg.siswa.local'),
  ('b0000000-0000-0000-0000-000000000032', '2026002@sman1bdg.siswa.local'),
  ('b0000000-0000-0000-0000-000000000033', '2026003@sman1bdg.siswa.local'),
  ('b0000000-0000-0000-0000-000000000034', '2026004@sman1bdg.siswa.local'),
  ('b0000000-0000-0000-0000-000000000035', '2026005@sman1bdg.siswa.local'),
  ('b0000000-0000-0000-0000-000000000036', '2026006@sman1bdg.siswa.local'),
  ('b0000000-0000-0000-0000-000000000037', '2026101@smpn2jkt.siswa.local'),
  ('b0000000-0000-0000-0000-000000000038', '2026102@smpn2jkt.siswa.local')
) as u (id, email);

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('b0000000-0000-0000-0000-000000000001', null, 'super_admin', 'Super Admin Ujianku', null),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000001', 'school_admin', 'Dewi Lestari', null),
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000002', 'school_admin', 'Agus Santoso', null),
  ('b0000000-0000-0000-0000-000000000021', 'a0000000-0000-0000-0000-000000000001', 'teacher', 'Budi Hartono', '198501012010011001'),
  ('b0000000-0000-0000-0000-000000000022', 'a0000000-0000-0000-0000-000000000001', 'teacher', 'Siti Rahmawati', '198703152011012002'),
  ('b0000000-0000-0000-0000-000000000023', 'a0000000-0000-0000-0000-000000000002', 'teacher', 'Rudi Setiawan', '199002202015011003'),
  ('b0000000-0000-0000-0000-000000000031', 'a0000000-0000-0000-0000-000000000001', 'student', 'Andi Pratama', '2026001'),
  ('b0000000-0000-0000-0000-000000000032', 'a0000000-0000-0000-0000-000000000001', 'student', 'Bunga Citra', '2026002'),
  ('b0000000-0000-0000-0000-000000000033', 'a0000000-0000-0000-0000-000000000001', 'student', 'Cahya Nugraha', '2026003'),
  ('b0000000-0000-0000-0000-000000000034', 'a0000000-0000-0000-0000-000000000001', 'student', 'Dimas Saputra', '2026004'),
  ('b0000000-0000-0000-0000-000000000035', 'a0000000-0000-0000-0000-000000000001', 'student', 'Eka Putri', '2026005'),
  ('b0000000-0000-0000-0000-000000000036', 'a0000000-0000-0000-0000-000000000001', 'student', 'Fajar Ramadhan', '2026006'),
  ('b0000000-0000-0000-0000-000000000037', 'a0000000-0000-0000-0000-000000000002', 'student', 'Gita Maharani', '2026101'),
  ('b0000000-0000-0000-0000-000000000038', 'a0000000-0000-0000-0000-000000000002', 'student', 'Hendra Wijaya', '2026102');

-- Fase 2: struktur sekolah -------------------------------------------------------
-- SMAN1BDG: 2025/2026 Genap (selesai) + 2026/2027 Ganjil (aktif); SMPN2JKT: 2026/2027 Ganjil (aktif)
-- Kelas: X IPA 1 (NIS 2026001–003, wali Budi), X IPA 2 (2026004–006, wali Siti), VII A (JKT, wali Rudi)

insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '2025/2026', 2, false),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '2026/2027', 1, true),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', '2026/2027', 1, true);

insert into public.subjects (id, tenant_id, code, name) values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'MTK', 'Matematika'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'BIO', 'Biologi'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'IPA', 'Ilmu Pengetahuan Alam');

insert into public.classes (id, tenant_id, academic_year_id, homeroom_teacher_id, name, grade_level) values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000021', 'X IPA 1', 10),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000022', 'X IPA 2', 10),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000023', 'VII A', 7);

-- tenant_id & academic_year_id diisi trigger dari kelas
insert into public.class_students (class_id, student_id) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000031'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000032'),
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000033'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000034'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000035'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000036'),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000037'),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000038');

insert into public.teaching_assignments (tenant_id, teacher_id, subject_id, class_id) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000021', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000022', 'd0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000023', 'd0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003');
