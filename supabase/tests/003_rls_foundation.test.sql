-- F1.3 — isolasi tenant & akses per peran di tabel fondasi
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into public.tenants (id, code, name, status, active_until) values
  ('00000000-0000-0000-0000-00000000000a', 'SEKOLAHA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('00000000-0000-0000-0000-00000000000b', 'SEKOLAHB', 'Sekolah B', 'active', now() + interval '30 days'),
  ('00000000-0000-0000-0000-00000000000c', 'SEKOLAHC', 'Sekolah C', 'inactive', now() - interval '1 day');

insert into public.subscriptions (tenant_id, period_start, period_end, amount, status, paid_at) values
  ('00000000-0000-0000-0000-00000000000a', current_date, current_date + 30, 100000, 'paid', now()),
  ('00000000-0000-0000-0000-00000000000b', current_date, current_date + 30, 100000, 'paid', now()),
  ('00000000-0000-0000-0000-00000000000c', current_date - 31, current_date - 1, 100000, 'paid', now());

insert into auth.users (id, email)
select ('10000000-0000-0000-0000-00000000000' || n)::uuid, 'u' || n || '@test.local'
from generate_series(1, 8) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('10000000-0000-0000-0000-000000000001', null, 'super_admin', 'Super Admin', null),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', '1980'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'student', 'Murid A1', '1001'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a', 'student', 'Murid A2', '1002'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b', 'school_admin', 'Admin B', null),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000b', 'student', 'Murid B1', '1001'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-00000000000c', 'school_admin', 'Admin C', null);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Super Admin melihat semua -----------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
-- difilter ke data fixture agar tidak terpengaruh seed.sql
select is((select count(*)::int from public.tenants where code like 'SEKOLAH_'), 3, 'SA: semua tenant');
select is((select count(*)::int from public.profiles where id::text like '10000000-%'), 8, 'SA: semua profil');
select is((select count(*)::int from public.subscriptions where tenant_id::text like '00000000-%'), 3, 'SA: semua langganan');

-- Admin Sekolah A ---------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select results_eq('select code from public.tenants', $$values ('SEKOLAHA')$$, 'Admin A: hanya tenant A');
select is((select count(*)::int from public.profiles), 4, 'Admin A: 4 profil sekolah A');
select is((select count(*)::int from public.profiles where tenant_id <> '00000000-0000-0000-0000-00000000000a'), 0,
  'Admin A: tidak melihat profil sekolah lain');
select is((select count(*)::int from public.subscriptions), 1, 'Admin A: langganan sekolahnya saja');

-- Admin A mencoba menulis: insert ditolak, update tidak mengenai baris apa pun
select throws_ok(
  $$insert into public.profiles (id, tenant_id, role, full_name) values
    ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-00000000000a', 'teacher', 'Guru Palsu')$$,
  '42501', null, 'Admin A: insert profil langsung ditolak (lewat API Route)'
);
update public.tenants set name = 'Diretas' where code = 'SEKOLAHA';
update public.profiles set role = 'super_admin', tenant_id = null where id = '10000000-0000-0000-0000-000000000002';

-- Guru A ------------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.profiles), 4, 'Guru A: profil sekolah A');
select is((select count(*)::int from public.subscriptions), 0, 'Guru A: tidak melihat langganan');

-- Murid A1 ----------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000004');
select results_eq('select full_name from public.profiles', $$values ('Murid A1')$$, 'Murid A1: hanya profil sendiri');
select is((select count(*)::int from public.tenants), 1, 'Murid A1: tenant sendiri');
select is((select count(*)::int from public.subscriptions), 0, 'Murid A1: tidak melihat langganan');

-- Admin sekolah nonaktif: 0 baris ----------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000008');
select is((select count(*)::int from public.tenants), 0, 'Tenant nonaktif: 0 tenant');
select is((select count(*)::int from public.profiles), 0, 'Tenant nonaktif: 0 profil (termasuk diri sendiri)');
select is((select count(*)::int from public.subscriptions), 0, 'Tenant nonaktif: 0 langganan');

-- Kembali ke SA: tulisan Admin A tadi tidak berpengaruh ----------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select is((select name from public.tenants where code = 'SEKOLAHA'), 'Sekolah A', 'Update tenant oleh Admin A tidak berpengaruh');
select is((select role::text from public.profiles where id = '10000000-0000-0000-0000-000000000002'), 'school_admin',
  'Admin A tidak bisa menaikkan perannya sendiri');

update public.tenants set name = 'Sekolah A Baru' where code = 'SEKOLAHA';
select is((select name from public.tenants where code = 'SEKOLAHA'), 'Sekolah A Baru', 'SA bisa mengubah tenant');
select throws_ok($$delete from public.tenants where code = 'SEKOLAHC'$$, '42501', null, 'Hapus tenant ditolak (tidak ada hapus permanen)');

-- anon --------------------------------------------------------------------------
reset role;
set local role anon;
select is((select count(*)::int from public.tenants), 0, 'anon: 0 tenant');

select * from finish();
rollback;
