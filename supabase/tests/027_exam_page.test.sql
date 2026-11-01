-- F3.8 — my_exams.attempt_id & in_exam_grace
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- Sekolah B masa aktif habis 1 jam lalu
insert into public.tenants (id, code, name, status, active_until) values
  ('b7000000-0000-0000-0000-00000000000a', 'EPA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('b7000000-0000-0000-0000-00000000000b', 'EPB', 'Sekolah B', 'inactive', now() - interval '1 hour');
insert into auth.users (id, email)
select ('b7100000-0000-0000-0000-00000000000' || n)::uuid, 'ep' || n || '@test.local' from generate_series(1, 5) n;
-- 1 guru A, 2 murid A, 3 guru B, 4 murid B (attempt berjalan), 5 murid B (tanpa attempt)
insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('b7100000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', 'G1'),
  ('b7100000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-00000000000a', 'student', 'Murid A', '1'),
  ('b7100000-0000-0000-0000-000000000003', 'b7000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1'),
  ('b7100000-0000-0000-0000-000000000004', 'b7000000-0000-0000-0000-00000000000b', 'student', 'Murid B1', '1'),
  ('b7100000-0000-0000-0000-000000000005', 'b7000000-0000-0000-0000-00000000000b', 'student', 'Murid B2', '2');
insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('b7200000-0000-0000-0000-00000000000a', 'b7000000-0000-0000-0000-00000000000a', '2026/2027', 1, true),
  ('b7200000-0000-0000-0000-00000000000b', 'b7000000-0000-0000-0000-00000000000b', '2026/2027', 1, true);
insert into public.subjects (id, tenant_id, code, name) values
  ('b7300000-0000-0000-0000-00000000000a', 'b7000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika'),
  ('b7300000-0000-0000-0000-00000000000b', 'b7000000-0000-0000-0000-00000000000b', 'MTK', 'Matematika');
insert into public.exams (id, tenant_id, academic_year_id, subject_id, created_by, title, start_at, end_at,
  duration_minutes, status, access_token) values
  ('b7500000-0000-0000-0000-00000000000a', 'b7000000-0000-0000-0000-00000000000a', 'b7200000-0000-0000-0000-00000000000a',
   'b7300000-0000-0000-0000-00000000000a', 'b7100000-0000-0000-0000-000000000001', 'EA',
   now() - interval '10 minutes', now() + interval '2 hours', 60, 'published', 'HJKLMN'),
  ('b7500000-0000-0000-0000-00000000000b', 'b7000000-0000-0000-0000-00000000000b', 'b7200000-0000-0000-0000-00000000000b',
   'b7300000-0000-0000-0000-00000000000b', 'b7100000-0000-0000-0000-000000000003', 'EB',
   now() - interval '2 hours', now() + interval '1 hour', 180, 'published', 'JKLMNP');
insert into public.exam_participants (tenant_id, exam_id, student_id) values
  ('b7000000-0000-0000-0000-00000000000a', 'b7500000-0000-0000-0000-00000000000a', 'b7100000-0000-0000-0000-000000000002'),
  ('b7000000-0000-0000-0000-00000000000b', 'b7500000-0000-0000-0000-00000000000b', 'b7100000-0000-0000-0000-000000000004'),
  ('b7000000-0000-0000-0000-00000000000b', 'b7500000-0000-0000-0000-00000000000b', 'b7100000-0000-0000-0000-000000000005');
insert into public.exam_attempts (id, tenant_id, exam_id, student_id, deadline_at) values
  ('b7600000-0000-0000-0000-00000000000a', 'b7000000-0000-0000-0000-00000000000a', 'b7500000-0000-0000-0000-00000000000a',
   'b7100000-0000-0000-0000-000000000002', now() + interval '50 minutes'),
  ('b7600000-0000-0000-0000-00000000000b', 'b7000000-0000-0000-0000-00000000000b', 'b7500000-0000-0000-0000-00000000000b',
   'b7100000-0000-0000-0000-000000000004', now() + interval '1 hour');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
set local role authenticated;

select pg_temp.login_as('b7100000-0000-0000-0000-000000000002');
select is((select attempt_id from public.my_exams()), 'b7600000-0000-0000-0000-00000000000a'::uuid,
  'my_exams mengembalikan attempt_id');

select pg_temp.login_as('b7100000-0000-0000-0000-000000000004');
select ok(public.in_exam_grace(), 'sekolah habis + attempt berjalan dalam masa tenggang → true');

select pg_temp.login_as('b7100000-0000-0000-0000-000000000005');
select ok(not public.in_exam_grace(), 'sekolah habis tanpa attempt → false');

reset role;
update public.exam_attempts set deadline_at = now() - interval '1 minute' where id = 'b7600000-0000-0000-0000-00000000000b';
set local role authenticated;
select pg_temp.login_as('b7100000-0000-0000-0000-000000000004');
select ok(not public.in_exam_grace(), 'attempt lewat batas waktu → false');

select pg_temp.login_as('b7100000-0000-0000-0000-000000000003');
select ok(not public.in_exam_grace(), 'guru → false');

select * from finish();
rollback;
