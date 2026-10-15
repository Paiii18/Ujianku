-- F2.2 — RPC activate_academic_year
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into public.tenants (id, code, name, status, active_until) values
  ('30000000-0000-0000-0000-00000000000a', 'AKTIFA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('30000000-0000-0000-0000-00000000000b', 'AKTIFB', 'Sekolah B', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('31000000-0000-0000-0000-00000000000' || n)::uuid, 'y' || n || '@test.local'
from generate_series(1, 3) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', 'G1'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-00000000000b', 'school_admin', 'Admin B', null);

insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('32000000-0000-0000-0000-0000000000a1', '30000000-0000-0000-0000-00000000000a', '2025/2026', 2, true),
  ('32000000-0000-0000-0000-0000000000a2', '30000000-0000-0000-0000-00000000000a', '2026/2027', 1, false),
  ('32000000-0000-0000-0000-0000000000b1', '30000000-0000-0000-0000-00000000000b', '2026/2027', 1, true);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Admin A mengaktifkan 2026/2027: yang lama otomatis nonaktif
select pg_temp.login_as('31000000-0000-0000-0000-000000000001');
select lives_ok($$select public.activate_academic_year('32000000-0000-0000-0000-0000000000a2')$$,
  'Admin A: aktifkan tahun ajaran');
select results_eq('select id from public.academic_years where is_active',
  $$values ('32000000-0000-0000-0000-0000000000a2'::uuid)$$, 'Admin A: hanya tahun ajaran baru yang aktif');
select lives_ok($$select public.activate_academic_year('32000000-0000-0000-0000-0000000000a2')$$,
  'Admin A: aktifkan ulang yang sudah aktif tidak error');

-- Admin A tidak bisa menyentuh sekolah B (tidak terlihat)
select throws_ok($$select public.activate_academic_year('32000000-0000-0000-0000-0000000000b1')$$,
  'P0002', null, 'Admin A: tahun ajaran sekolah B tidak ditemukan');

-- Guru A: baca saja
select pg_temp.login_as('31000000-0000-0000-0000-000000000002');
select throws_ok($$select public.activate_academic_year('32000000-0000-0000-0000-0000000000a1')$$,
  null, null, 'Guru A: tidak bisa mengaktifkan');

-- Admin B: tahun ajaran B tetap aktif
select pg_temp.login_as('31000000-0000-0000-0000-000000000003');
select is((select is_active from public.academic_years where id = '32000000-0000-0000-0000-0000000000b1'), true,
  'Sekolah B tidak terpengaruh');

-- anon tidak bisa memanggil
reset role;
set local role anon;
select throws_ok($$select public.activate_academic_year('32000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'anon: ditolak');

select * from finish();
rollback;
