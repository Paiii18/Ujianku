-- F1.11 — my_school(): nama sekolah terbaca walau nonaktif, hanya sekolah sendiri
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into public.tenants (id, code, name, status, active_until) values
  ('00000000-0000-0000-0000-00000000000a', 'AKTIF', 'Sekolah Aktif', 'active', '2030-01-01 00:00+07'),
  ('00000000-0000-0000-0000-00000000000b', 'HABIS', 'Sekolah Habis', 'inactive', '2026-01-01 00:00+07');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'sa@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'admin.a@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'murid.b@test.local');
insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('10000000-0000-0000-0000-000000000001', null, 'super_admin', 'SA', null),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', 'student', 'Murid B', '1');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select results_eq('select code, name, active_until from public.my_school()',
  $$values ('AKTIF', 'Sekolah Aktif', '2030-01-01 00:00+07'::timestamptz)$$,
  'Admin A: sekolahnya sendiri');

select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
select results_eq('select code, name from public.my_school()',
  $$values ('HABIS', 'Sekolah Habis')$$,
  'Murid sekolah nonaktif tetap bisa membaca nama sekolahnya');

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select is_empty('select * from public.my_school()', 'Super Admin: 0 baris');

reset role;
set local role anon;
select throws_ok('select * from public.my_school()', '42501', null, 'anon tidak bisa memanggil');

select * from finish();
rollback;
