-- F3.2 — Trigger peserta ujian dari kelas
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Data (sebagai postgres) ----------------------------------------------------------------

insert into public.tenants (id, code, name, status, active_until) values
  ('ab000000-0000-0000-0000-00000000000a', 'EPA', 'Sekolah A', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('ab100000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'ep' || n || '@test.local'
from generate_series(1, 6) n;

-- 01 guru, 02 admin, 03 murid K1, 04 murid K2, 05 murid baru, 06 murid pindah
insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('ab100000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000a', 'teacher', 'Guru', 'G1'),
  ('ab100000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin', null),
  ('ab100000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-00000000000a', 'student', 'Murid 1', '001'),
  ('ab100000-0000-0000-0000-000000000004', 'ab000000-0000-0000-0000-00000000000a', 'student', 'Murid 2', '002'),
  ('ab100000-0000-0000-0000-000000000005', 'ab000000-0000-0000-0000-00000000000a', 'student', 'Murid 3', '003'),
  ('ab100000-0000-0000-0000-000000000006', 'ab000000-0000-0000-0000-00000000000a', 'student', 'Murid 4', '004');

insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('ab200000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000a', '2026/2027', 1, true);
insert into public.subjects (id, tenant_id, code, name) values
  ('ab300000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika');
-- K1, K2, K3 (K3 tidak ikut ujian)
insert into public.classes (id, tenant_id, academic_year_id, name, grade_level) values
  ('ab400000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001', 'X 1', 10),
  ('ab400000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001', 'X 2', 10),
  ('ab400000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001', 'X 3', 10);
insert into public.teaching_assignments (tenant_id, teacher_id, subject_id, class_id)
select 'ab000000-0000-0000-0000-00000000000a', 'ab100000-0000-0000-0000-000000000001', 'ab300000-0000-0000-0000-000000000001', c
from unnest(array['ab400000-0000-0000-0000-000000000001', 'ab400000-0000-0000-0000-000000000002']::uuid[]) c;

insert into public.class_students (class_id, student_id, tenant_id, academic_year_id) values
  ('ab400000-0000-0000-0000-000000000001', 'ab100000-0000-0000-0000-000000000003', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001'),
  ('ab400000-0000-0000-0000-000000000002', 'ab100000-0000-0000-0000-000000000004', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001'),
  ('ab400000-0000-0000-0000-000000000003', 'ab100000-0000-0000-0000-000000000006', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001');

-- E1 berjalan, E2 sudah selesai (keduanya untuk K1)
insert into public.exams (id, tenant_id, academic_year_id, subject_id, created_by, title, start_at, end_at, duration_minutes) values
  ('ab500000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001', 'ab300000-0000-0000-0000-000000000001', 'ab100000-0000-0000-0000-000000000001', 'E1', now(), now() + interval '2 hours', 60),
  ('ab500000-0000-0000-0000-000000000002', 'ab000000-0000-0000-0000-00000000000a', 'ab200000-0000-0000-0000-000000000001', 'ab300000-0000-0000-0000-000000000001', 'ab100000-0000-0000-0000-000000000001', 'E2', now() - interval '2 days', now() - interval '1 day', 60);
insert into public.exam_classes (exam_id, class_id, tenant_id) values
  ('ab500000-0000-0000-0000-000000000002', 'ab400000-0000-0000-0000-000000000001', 'ab000000-0000-0000-0000-00000000000a');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Peserta E1/E2 (dibaca sebagai postgres agar tidak bergantung RLS)
create function pg_temp.participants(p_exam uuid) returns text[] language sql security definer as $$
  select coalesce(array_agg(p.full_name order by p.full_name), '{}')
  from public.exam_participants ep join public.profiles p on p.id = ep.student_id
  where ep.exam_id = p_exam;
$$;

set local role authenticated;

-- Guru menambah kelas --------------------------------------------------------------------
select pg_temp.login_as('ab100000-0000-0000-0000-000000000001');

insert into public.exam_classes (exam_id, class_id) values
  ('ab500000-0000-0000-0000-000000000001', 'ab400000-0000-0000-0000-000000000001');
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000001'), array['Murid 1'],
  'tambah kelas K1 → murid K1 jadi peserta');

insert into public.exam_classes (exam_id, class_id) values
  ('ab500000-0000-0000-0000-000000000001', 'ab400000-0000-0000-0000-000000000002');
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000001'), array['Murid 1', 'Murid 2'],
  'tambah kelas K2 → murid K2 ikut ditambahkan');

-- Murid perorangan
insert into public.exam_participants (exam_id, student_id) values
  ('ab500000-0000-0000-0000-000000000002', 'ab100000-0000-0000-0000-000000000004');
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000002'), array['Murid 1', 'Murid 2'],
  'guru menambah murid perorangan (Murid 2) ke E2');

-- Admin menambah murid ke kelas ------------------------------------------------------------
select pg_temp.login_as('ab100000-0000-0000-0000-000000000002');

insert into public.class_students (class_id, student_id, academic_year_id) values
  ('ab400000-0000-0000-0000-000000000001', 'ab100000-0000-0000-0000-000000000005', 'ab200000-0000-0000-0000-000000000001');
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000001'), array['Murid 1', 'Murid 2', 'Murid 3'],
  'murid baru masuk K1 → ikut ujian yang belum selesai');
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000002'), array['Murid 1', 'Murid 2'],
  'murid baru tidak ikut ujian yang sudah selesai');

update public.class_students set class_id = 'ab400000-0000-0000-0000-000000000002'
where student_id = 'ab100000-0000-0000-0000-000000000006';
select ok('Murid 4' = any(pg_temp.participants('ab500000-0000-0000-0000-000000000001')),
  'murid pindah dari K3 ke K2 → ikut ujian K2');

select throws_ok($$insert into public.exam_participants (exam_id, student_id) values
  ('ab500000-0000-0000-0000-000000000001', 'ab100000-0000-0000-0000-000000000005')$$,
  '42501', null, 'admin tetap tidak bisa menulis peserta langsung');

-- Guru menghapus kelas ---------------------------------------------------------------------
reset role;
insert into public.exam_attempts (tenant_id, exam_id, student_id, deadline_at) values
  ('ab000000-0000-0000-0000-00000000000a', 'ab500000-0000-0000-0000-000000000001', 'ab100000-0000-0000-0000-000000000003', now() + interval '1 hour');
set local role authenticated;
select pg_temp.login_as('ab100000-0000-0000-0000-000000000001');

delete from public.exam_classes
where exam_id = 'ab500000-0000-0000-0000-000000000001' and class_id = 'ab400000-0000-0000-0000-000000000001';
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000001'), array['Murid 1', 'Murid 2', 'Murid 4'],
  'hapus K1 → Murid 3 keluar, Murid 1 tetap (sudah punya attempt)');

delete from public.exam_classes
where exam_id = 'ab500000-0000-0000-0000-000000000002' and class_id = 'ab400000-0000-0000-0000-000000000001';
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000002'), array['Murid 2'],
  'hapus K1 dari E2 → murid perorangan dari kelas lain tetap');

-- Sekolah lain / murid tak terlihat --------------------------------------------------------
select is((select count(*)::int from public.exam_participants where exam_id = 'ab500000-0000-0000-0000-000000000001'), 3,
  'guru membaca peserta ujiannya');
select pg_temp.login_as('ab100000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.exam_participants), 0, 'murid tidak membaca daftar peserta');

-- Hapus ujian: peserta ikut terhapus (cascade), trigger hapus-kelas tidak mengganggu
reset role;
delete from public.exam_attempts where exam_id = 'ab500000-0000-0000-0000-000000000001';
select lives_ok($$delete from public.exams where id = 'ab500000-0000-0000-0000-000000000001'$$,
  'ujian dengan kelas bisa dihapus');
select is(pg_temp.participants('ab500000-0000-0000-0000-000000000001'), '{}'::text[], 'peserta ikut terhapus');

select * from finish();
rollback;
