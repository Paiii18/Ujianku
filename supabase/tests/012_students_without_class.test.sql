-- F2.5 — students_without_class
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.tenants (id, code, name, status, active_until) values
  ('50000000-0000-0000-0000-00000000000a', 'KLSA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('50000000-0000-0000-0000-00000000000b', 'KLSB', 'Sekolah B', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('51000000-0000-0000-0000-00000000000' || n)::uuid, 'w' || n || '@test.local'
from generate_series(1, 5) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip, is_active) values
  ('51000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null, true),
  ('51000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000a', 'student', 'Ani', '101', true),
  ('51000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-00000000000a', 'student', 'Budi', '102', true),
  ('51000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-00000000000a', 'student', 'Cici', '103', false),
  ('51000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-00000000000b', 'student', 'Dodi', '104', true);

insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('52000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', '2026/2027', 1, true),
  ('52000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000a', '2025/2026', 2, false);
insert into public.classes (id, tenant_id, academic_year_id, name, grade_level) values
  ('53000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-00000000000a', '52000000-0000-0000-0000-000000000001', 'X-1', 10),
  ('53000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-00000000000a', '52000000-0000-0000-0000-000000000002', 'X-1', 10);
insert into public.class_students (class_id, student_id) values
  ('53000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002'),
  ('53000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select results_eq($$select full_name from public.students_without_class('52000000-0000-0000-0000-000000000001')$$,
  $$values ('Budi')$$, 'Tahun aktif: hanya murid aktif tanpa kelas (bukan nonaktif, bukan sekolah lain)');
select results_eq($$select full_name from public.students_without_class('52000000-0000-0000-0000-000000000002')$$,
  $$values ('Ani')$$, 'Tahun lain dihitung terpisah');
select results_eq($$select full_name from public.students_without_class('52000000-0000-0000-0000-000000000001', 'bud')$$,
  $$values ('Budi')$$, 'Cari nama');
select results_eq($$select full_name from public.students_without_class('52000000-0000-0000-0000-000000000001', '102')$$,
  $$values ('Budi')$$, 'Cari NIS');
select is((select count(*)::int from public.students_without_class('52000000-0000-0000-0000-000000000001', 'xyz')), 0, 'Tidak cocok: kosong');

select * from finish();
rollback;
