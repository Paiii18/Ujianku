-- F2.1 — struktur sekolah: constraint, isolasi tenant, akses per peran
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Fixture (sebagai postgres, tanpa RLS) -------------------------------------------
insert into public.tenants (id, code, name, status, active_until) values
  ('20000000-0000-0000-0000-00000000000a', 'STRUKA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('20000000-0000-0000-0000-00000000000b', 'STRUKB', 'Sekolah B', 'active', now() + interval '30 days'),
  ('20000000-0000-0000-0000-00000000000c', 'STRUKC', 'Sekolah C', 'inactive', now() - interval '1 day');

insert into auth.users (id, email)
select ('21000000-0000-0000-0000-00000000000' || n)::uuid, 's' || n || '@test.local'
from generate_series(1, 9) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('21000000-0000-0000-0000-000000000001', null, 'super_admin', 'SA', null),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', 'G1'),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-00000000000a', 'student', 'Murid A1', '1'),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-00000000000a', 'student', 'Murid A2', '2'),
  ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-00000000000b', 'school_admin', 'Admin B', null),
  ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1'),
  ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-00000000000b', 'student', 'Murid B1', '1'),
  ('21000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-00000000000c', 'school_admin', 'Admin C', null);

insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('22000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', '2026/2027', 1, true),
  ('22000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a', '2025/2026', 2, false),
  ('22000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-00000000000b', '2026/2027', 1, true),
  ('22000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-00000000000c', '2026/2027', 1, true);

insert into public.subjects (id, tenant_id, code, name) values
  ('23000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika'),
  ('23000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-00000000000b', 'MTK', 'Matematika');

insert into public.classes (id, tenant_id, academic_year_id, homeroom_teacher_id, name, grade_level) values
  ('24000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-00000000000a', '22000000-0000-0000-0000-0000000000a1', '21000000-0000-0000-0000-000000000003', 'X-1', 10),
  ('24000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-00000000000a', '22000000-0000-0000-0000-0000000000a1', null, 'X-2', 10),
  ('24000000-0000-0000-0000-0000000000b1', '20000000-0000-0000-0000-00000000000b', '22000000-0000-0000-0000-0000000000b1', null, 'X-1', 10);

insert into public.class_students (class_id, student_id) values
  ('24000000-0000-0000-0000-0000000000a1', '21000000-0000-0000-0000-000000000004'),
  ('24000000-0000-0000-0000-0000000000b1', '21000000-0000-0000-0000-000000000008');

insert into public.teaching_assignments (tenant_id, teacher_id, subject_id, class_id) values
  ('20000000-0000-0000-0000-00000000000a', '21000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-0000000000a1', '24000000-0000-0000-0000-0000000000a1'),
  ('20000000-0000-0000-0000-00000000000b', '21000000-0000-0000-0000-000000000007', '23000000-0000-0000-0000-0000000000b1', '24000000-0000-0000-0000-0000000000b1');

-- Constraint ------------------------------------------------------------------------
select is(
  (select academic_year_id from public.class_students where student_id = '21000000-0000-0000-0000-000000000004'),
  '22000000-0000-0000-0000-0000000000a1'::uuid, 'class_students: tahun ajaran diisi trigger dari kelas'
);
select throws_ok(
  $$insert into public.academic_years (tenant_id, name, semester, is_active)
    values ('20000000-0000-0000-0000-00000000000a', '2027/2028', 1, true)$$,
  '23505', null, 'Hanya satu tahun ajaran aktif per sekolah'
);
select lives_ok(
  $$insert into public.academic_years (tenant_id, name, semester, is_active)
    values ('20000000-0000-0000-0000-00000000000b', '2025/2026', 2, false)$$,
  'Tahun ajaran nonaktif boleh lebih dari satu'
);
select throws_ok(
  $$insert into public.class_students (class_id, student_id)
    values ('24000000-0000-0000-0000-0000000000a2', '21000000-0000-0000-0000-000000000004')$$,
  '23505', null, 'Satu murid satu kelas per tahun ajaran'
);
select throws_ok(
  $$insert into public.subjects (tenant_id, code, name) values ('20000000-0000-0000-0000-00000000000a', 'MTK', 'Lain')$$,
  '23505', null, 'Kode mapel unik per sekolah'
);
select throws_ok(
  $$insert into public.class_students (class_id, student_id)
    values ('24000000-0000-0000-0000-0000000000a2', '21000000-0000-0000-0000-000000000003')$$,
  '23514', null, 'Guru tidak bisa dimasukkan sebagai murid kelas'
);
select throws_ok(
  $$update public.classes set homeroom_teacher_id = '21000000-0000-0000-0000-000000000005'
    where id = '24000000-0000-0000-0000-0000000000a2'$$,
  '23514', null, 'Wali kelas harus guru'
);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Super Admin -------------------------------------------------------------------------
select pg_temp.login_as('21000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.classes where id::text like '24000000-%'), 3, 'SA: semua kelas');
select is((select count(*)::int from public.class_students where class_id::text like '24000000-%'), 2, 'SA: semua anggota kelas');

-- Admin Sekolah A ---------------------------------------------------------------------
select pg_temp.login_as('21000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.academic_years), 2, 'Admin A: tahun ajaran sekolah A saja');
select results_eq('select name from public.subjects', $$values ('Matematika')$$, 'Admin A: mapel sekolah A saja');
select is((select count(*)::int from public.classes), 2, 'Admin A: kelas sekolah A saja');
select is((select count(*)::int from public.class_students), 1, 'Admin A: anggota kelas sekolah A saja');
select is((select count(*)::int from public.teaching_assignments), 1, 'Admin A: penugasan sekolah A saja');

select lives_ok(
  $$insert into public.subjects (code, name) values ('BIO', 'Biologi')$$,
  'Admin A: tambah mapel tanpa tenant_id (default tenant sendiri)'
);
select is((select tenant_id from public.subjects where code = 'BIO'),
  '20000000-0000-0000-0000-00000000000a'::uuid, 'Admin A: mapel baru tercatat di tenant A');
select throws_ok(
  $$insert into public.subjects (tenant_id, code, name) values ('20000000-0000-0000-0000-00000000000b', 'FIS', 'Fisika')$$,
  '42501', null, 'Admin A: tidak bisa menulis ke tenant B'
);
select throws_ok(
  $$insert into public.classes (academic_year_id, name, grade_level) values ('22000000-0000-0000-0000-0000000000b1', 'Palsu', 10)$$,
  '23503', null, 'Admin A: kelas tidak bisa memakai tahun ajaran sekolah B'
);
select throws_ok(
  $$insert into public.class_students (class_id, student_id)
    values ('24000000-0000-0000-0000-0000000000a2', '21000000-0000-0000-0000-000000000008')$$,
  '23514', null, 'Admin A: murid sekolah B tidak bisa masuk kelas A'
);
select throws_ok(
  $$insert into public.teaching_assignments (teacher_id, subject_id, class_id) values
    ('21000000-0000-0000-0000-000000000007', '23000000-0000-0000-0000-0000000000a1', '24000000-0000-0000-0000-0000000000a2')$$,
  '23514', null, 'Admin A: guru sekolah B tidak bisa ditugaskan di sekolah A'
);
select throws_ok(
  $$delete from public.subjects where id = '23000000-0000-0000-0000-0000000000a1'$$,
  '23503', null, 'Admin A: mapel yang dipakai penugasan tidak bisa dihapus'
);
delete from public.classes where id = '24000000-0000-0000-0000-0000000000b1';

-- Guru A: hanya baca --------------------------------------------------------------------
select pg_temp.login_as('21000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.classes), 2, 'Guru A: baca kelas sekolah A');
select throws_ok(
  $$insert into public.subjects (code, name) values ('KIM', 'Kimia')$$,
  '42501', null, 'Guru A: tidak bisa menambah mapel'
);

-- Murid A1: tidak ada akses (matriks PRD) -------------------------------------------------
select pg_temp.login_as('21000000-0000-0000-0000-000000000004');
select is(
  (select count(*)::int from public.academic_years) + (select count(*)::int from public.subjects)
  + (select count(*)::int from public.classes) + (select count(*)::int from public.class_students)
  + (select count(*)::int from public.teaching_assignments),
  0, 'Murid: 0 baris di semua tabel struktur'
);

-- Admin sekolah nonaktif ----------------------------------------------------------------
select pg_temp.login_as('21000000-0000-0000-0000-000000000009');
select is((select count(*)::int from public.academic_years), 0, 'Tenant nonaktif: 0 tahun ajaran');

-- (profil sekolah B tak terlihat oleh Admin A → trigger peran menolak duluan; FK komposit jadi pengaman bila RLS dilewati)
-- Kembali ke SA: delete oleh Admin A tidak mengenai kelas B ---------------------------------
select pg_temp.login_as('21000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.classes where id = '24000000-0000-0000-0000-0000000000b1'), 1,
  'Delete kelas B oleh Admin A tidak berpengaruh');

select * from finish();
rollback;
