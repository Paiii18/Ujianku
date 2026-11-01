-- F3.4 — Token ujian: unik, tanpa karakter ambigu, bisa diperbarui pemilik
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.tenants (id, code, name, status, active_until) values
  ('ad000000-0000-0000-0000-00000000000a', 'TKA', 'Sekolah A', 'active', now() + interval '30 days');
insert into auth.users (id, email)
select ('ad100000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'tk' || n || '@test.local'
from generate_series(1, 3) n;
-- 01 guru pemilik, 02 guru lain, 03 admin
insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('ad100000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', 'teacher', 'Guru', 'G1'),
  ('ad100000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 2', 'G2'),
  ('ad100000-0000-0000-0000-000000000003', 'ad000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin', null);
insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('ad200000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', '2026/2027', 1, true);
insert into public.subjects (id, tenant_id, code, name) values
  ('ad300000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika');
-- E1 terbit, E2 draft
insert into public.exams (id, tenant_id, academic_year_id, subject_id, created_by, title, start_at, end_at,
  duration_minutes, status, access_token) values
  ('ad500000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-00000000000a', 'ad200000-0000-0000-0000-000000000001',
   'ad300000-0000-0000-0000-000000000001', 'ad100000-0000-0000-0000-000000000001', 'E1', now(), now() + interval '2 hours', 60,
   'published', 'ABCDEF'),
  ('ad500000-0000-0000-0000-000000000002', 'ad000000-0000-0000-0000-00000000000a', 'ad200000-0000-0000-0000-000000000001',
   'ad300000-0000-0000-0000-000000000001', 'ad100000-0000-0000-0000-000000000001', 'E2', now(), now() + interval '2 hours', 60,
   'draft', null);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Generator ------------------------------------------------------------------------------
select ok((select bool_and(public.random_exam_token() ~ '^[A-HJ-NP-Z2-9]{6}$') from generate_series(1, 2000)),
  '2000 token: 6 karakter tanpa 0/O/1/I');
select ok((select count(distinct public.random_exam_token()) = 2000 from generate_series(1, 2000)),
  '2000 token berbeda');
select throws_ok($$update public.exams set access_token = 'ABCDEF' where id = 'ad500000-0000-0000-0000-000000000002'$$,
  '23505', null, 'token yang sama di dua ujian ditolak (index unik)');

-- Perbarui -------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.login_as('ad100000-0000-0000-0000-000000000001');

select ok(public.refresh_exam_token('ad500000-0000-0000-0000-000000000001') ~ '^[A-HJ-NP-Z2-9]{6}$',
  'pemilik memperbarui token');
select isnt((select access_token::text from public.exams where id = 'ad500000-0000-0000-0000-000000000001'), 'ABCDEF',
  'token tersimpan berubah');
select is((select count(*)::int from public.exams where access_token = 'ABCDEF'), 0,
  'token lama tidak lagi cocok dengan ujian mana pun');
select throws_ok($$select public.refresh_exam_token('ad500000-0000-0000-0000-000000000002')$$, '22023',
  'Ujian tidak ditemukan atau belum terbit', 'ujian draft tidak bisa diperbarui tokennya');

create temp table cur as select access_token from public.exams where id = 'ad500000-0000-0000-0000-000000000001';
grant select on cur to authenticated;

select pg_temp.login_as('ad100000-0000-0000-0000-000000000002');
select throws_ok($$select public.refresh_exam_token('ad500000-0000-0000-0000-000000000001')$$, '22023',
  'Ujian tidak ditemukan atau belum terbit', 'guru lain ditolak');
select pg_temp.login_as('ad100000-0000-0000-0000-000000000003');
select throws_ok($$select public.refresh_exam_token('ad500000-0000-0000-0000-000000000001')$$, '22023',
  'Ujian tidak ditemukan atau belum terbit', 'Admin Sekolah ditolak');
select is((select access_token from public.exams where id = 'ad500000-0000-0000-0000-000000000001'),
  (select access_token from cur), 'token tidak berubah oleh guru lain / admin');

select * from finish();
rollback;
