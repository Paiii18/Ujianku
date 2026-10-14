-- F1.2 — fungsi helper RLS per peran & status tenant
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into public.tenants (id, code, name, status, active_until) values
  ('00000000-0000-0000-0000-00000000000a', 'AKTIF', 'Sekolah Aktif', 'active', now() + interval '10 days'),
  ('00000000-0000-0000-0000-00000000000b', 'HABIS', 'Sekolah Habis', 'inactive', now() - interval '1 day'),
  -- status masih active tapi tanggal sudah lewat (pg_cron belum jalan)
  ('00000000-0000-0000-0000-00000000000c', 'TELAT', 'Sekolah Telat', 'active', now() - interval '1 hour');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'sa@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'admin@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'guru@test.local'),
  ('10000000-0000-0000-0000-000000000004', 'murid@test.local'),
  ('10000000-0000-0000-0000-000000000005', 'habis@test.local'),
  ('10000000-0000-0000-0000-000000000006', 'telat@test.local');

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('10000000-0000-0000-0000-000000000001', null, 'super_admin', 'Super Admin', null),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin', null),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'teacher', 'Guru', '198001'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'student', 'Murid', '1001'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000b', 'student', 'Murid Habis', '1001'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000c', 'teacher', 'Guru Telat', '1');

-- Login sebagai user tertentu (meniru JWT Supabase)
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Super Admin
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select is(public.my_role(), 'super_admin', 'SA: my_role');
select is(public.my_tenant(), null, 'SA: tanpa tenant');
select ok(public.is_super_admin(), 'SA: is_super_admin');
select ok(not public.tenant_is_active(), 'SA: tenant_is_active false');

-- Admin Sekolah, Guru, Murid di sekolah aktif
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select is(public.my_role(), 'school_admin', 'Admin: my_role');
select is(public.my_tenant(), '00000000-0000-0000-0000-00000000000a'::uuid, 'Admin: my_tenant');
select ok(not public.is_super_admin(), 'Admin: bukan super admin');
select ok(public.tenant_is_active(), 'Admin: tenant aktif');

select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
select is(public.my_role(), 'teacher', 'Guru: my_role');
select ok(public.tenant_is_active(), 'Guru: tenant aktif');

select pg_temp.login_as('10000000-0000-0000-0000-000000000004');
select is(public.my_role(), 'student', 'Murid: my_role');
select is(public.my_tenant(), '00000000-0000-0000-0000-00000000000a'::uuid, 'Murid: my_tenant');
select ok(public.tenant_is_active(), 'Murid: tenant aktif');

-- Tenant nonaktif & tenant yang tanggalnya lewat
select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select is(public.my_tenant(), '00000000-0000-0000-0000-00000000000b'::uuid, 'Habis: my_tenant tetap terbaca');
select ok(not public.tenant_is_active(), 'Habis: tenant nonaktif');

select pg_temp.login_as('10000000-0000-0000-0000-000000000006');
select ok(not public.tenant_is_active(), 'Telat: active_until lewat = nonaktif walau status active');

-- User tanpa profil
select pg_temp.login_as('99999999-0000-0000-0000-000000000000');
select is(public.my_role(), null, 'Tanpa profil: my_role null');
select ok(not public.is_super_admin() and not public.tenant_is_active(), 'Tanpa profil: semua false');

-- anon tidak boleh memanggil helper
reset role;
set local role anon;
select throws_ok('select public.my_tenant()', '42501', null, 'anon tidak bisa memanggil helper');

select * from finish();
rollback;
