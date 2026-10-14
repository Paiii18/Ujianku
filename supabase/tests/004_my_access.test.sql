-- F1.6 — my_access(): data yang dipakai proxy
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.tenants (id, code, name, status, active_until) values
  ('00000000-0000-0000-0000-00000000000a', 'AKTIF', 'Sekolah Aktif', 'active', now() + interval '10 days'),
  ('00000000-0000-0000-0000-00000000000b', 'HABIS', 'Sekolah Habis', 'inactive', now() - interval '1 day');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'sa@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'guru@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'nonaktif@test.local'),
  ('10000000-0000-0000-0000-000000000004', 'habis@test.local');

insert into public.profiles (id, tenant_id, role, full_name, nis_nip, is_active) values
  ('10000000-0000-0000-0000-000000000001', null, 'super_admin', 'SA', null, true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'teacher', 'Guru', '1', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'student', 'Murid Nonaktif', '1001', false),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000b', 'student', 'Murid Habis', '1001', true);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select results_eq('select role::text, is_active, tenant_active from public.my_access()',
  $$values ('super_admin', true, false)$$, 'SA: tenant_active false (proxy tidak memeriksanya untuk SA)');

select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select results_eq('select role::text, is_active, tenant_active from public.my_access()',
  $$values ('teacher', true, true)$$, 'Guru sekolah aktif');

select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
select results_eq('select role::text, is_active, tenant_active from public.my_access()',
  $$values ('student', false, true)$$, 'Akun nonaktif terbaca is_active = false');

select pg_temp.login_as('10000000-0000-0000-0000-000000000004');
select results_eq('select role::text, is_active, tenant_active from public.my_access()',
  $$values ('student', true, false)$$, 'Sekolah habis tetap terbaca (untuk redirect)');

select pg_temp.login_as('99999999-0000-0000-0000-000000000000');
select is_empty('select * from public.my_access()', 'Tanpa profil: 0 baris');

reset role;
set local role anon;
select throws_ok('select * from public.my_access()', '42501', null, 'anon tidak bisa memanggil');

select * from finish();
rollback;
