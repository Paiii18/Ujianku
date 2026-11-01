-- F3.6 — my_exams: murid hanya melihat ujian terbit di mana ia peserta
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.tenants (id, code, name, status, active_until) values
  ('ae000000-0000-0000-0000-00000000000a', 'MEA', 'Sekolah A', 'active', now() + interval '30 days');
insert into auth.users (id, email)
select ('ae100000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'me' || n || '@test.local'
from generate_series(1, 3) n;
-- 01 guru, 02 murid peserta, 03 murid bukan peserta
insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('ae100000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-00000000000a', 'teacher', 'Guru', 'G1'),
  ('ae100000-0000-0000-0000-000000000002', 'ae000000-0000-0000-0000-00000000000a', 'student', 'Murid 1', '001'),
  ('ae100000-0000-0000-0000-000000000003', 'ae000000-0000-0000-0000-00000000000a', 'student', 'Murid 2', '002');
insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('ae200000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-00000000000a', '2026/2027', 1, true),
  ('ae200000-0000-0000-0000-000000000000', 'ae000000-0000-0000-0000-00000000000a', '2025/2026', 2, false);
insert into public.subjects (id, tenant_id, code, name) values
  ('ae300000-0000-0000-0000-000000000001', 'ae000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika');

-- E1 terbit (peserta), E2 draft (peserta), E3 terbit (bukan peserta), E4 terbit tahun lalu (peserta)
insert into public.exams (id, tenant_id, academic_year_id, subject_id, created_by, title, start_at, end_at,
  duration_minutes, status, access_token)
select ('ae500000-0000-0000-0000-00000000000' || n)::uuid, 'ae000000-0000-0000-0000-00000000000a',
  case when n = 4 then 'ae200000-0000-0000-0000-000000000000' else 'ae200000-0000-0000-0000-000000000001' end::uuid,
  'ae300000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000001', 'E' || n,
  now(), now() + interval '2 hours', 60,
  case when n = 2 then 'draft' else 'published' end::public.exam_status,
  case when n = 2 then null else 'XYZWV' || chr(64 + n) end
from generate_series(1, 4) n;
insert into public.exam_participants (tenant_id, exam_id, student_id) values
  ('ae000000-0000-0000-0000-00000000000a', 'ae500000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000002'),
  ('ae000000-0000-0000-0000-00000000000a', 'ae500000-0000-0000-0000-000000000002', 'ae100000-0000-0000-0000-000000000002'),
  ('ae000000-0000-0000-0000-00000000000a', 'ae500000-0000-0000-0000-000000000004', 'ae100000-0000-0000-0000-000000000002'),
  ('ae000000-0000-0000-0000-00000000000a', 'ae500000-0000-0000-0000-000000000003', 'ae100000-0000-0000-0000-000000000003');
insert into public.exam_attempts (tenant_id, exam_id, student_id, deadline_at) values
  ('ae000000-0000-0000-0000-00000000000a', 'ae500000-0000-0000-0000-000000000001', 'ae100000-0000-0000-0000-000000000002', now() + interval '1 hour');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login_as('ae100000-0000-0000-0000-000000000002');
select results_eq($$select title, subject_name, attempt_status::text from public.my_exams()$$,
  $$values ('E1', 'Matematika', 'in_progress')$$,
  'murid: hanya E1 (bukan draft, bukan ujian orang lain, bukan tahun ajaran lalu) + status attempt');
select is((select count(*)::int from public.exams), 0, 'murid tetap tidak bisa membaca tabel exams');

select pg_temp.login_as('ae100000-0000-0000-0000-000000000003');
select results_eq($$select title, attempt_status::text from public.my_exams()$$,
  $$values ('E3', null::text)$$, 'murid lain: hanya E3, belum mulai');

select pg_temp.login_as('ae100000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.my_exams()), 0, 'guru: 0 baris');

-- Kolom tidak memuat token
select is((select count(*)::int from pg_proc, unnest(proargnames) a
  where proname = 'my_exams' and a ilike '%token%'), 0, 'hasil tanpa kolom token');

reset role;
update public.tenants set status = 'inactive' where id = 'ae000000-0000-0000-0000-00000000000a';
set local role authenticated;
select pg_temp.login_as('ae100000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.my_exams()), 0, 'sekolah nonaktif: 0 baris');

select pg_temp.login_as('00000000-0000-0000-0000-000000000000');
select is((select count(*)::int from public.my_exams()), 0, 'tanpa profil: 0 baris');

select * from finish();
rollback;
