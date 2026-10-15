-- F2.3 — RPC akun guru & murid + akun nonaktif kehilangan akses
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into public.tenants (id, code, name, status, active_until) values
  ('40000000-0000-0000-0000-00000000000a', 'AKUNA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('40000000-0000-0000-0000-00000000000b', 'AKUNB', 'Sekolah B', 'active', now() + interval '30 days'),
  ('40000000-0000-0000-0000-00000000000c', 'AKUNC', 'Sekolah C', 'inactive', now() - interval '1 day');

-- 1–6 punya profil; 7–9 akun Auth baru yang akan dibuatkan profil oleh RPC
insert into auth.users (id, email)
select ('41000000-0000-0000-0000-00000000000' || n)::uuid, 'k' || n || '@test.local'
from generate_series(1, 9) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', 'G1'),
  ('41000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-00000000000a', 'student', 'Murid A', '100'),
  ('41000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-00000000000b', 'student', 'Murid B', '100'),
  ('41000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-00000000000c', 'school_admin', 'Admin C', null),
  ('41000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A2', null);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Admin A membuat akun ------------------------------------------------------------------
select pg_temp.login_as('41000000-0000-0000-0000-000000000001');
select lives_ok($$select public.create_school_user('41000000-0000-0000-0000-000000000007', 'student', ' Murid Baru ', '200')$$,
  'Admin A: buat murid');
select is((select tenant_id from public.profiles where id = '41000000-0000-0000-0000-000000000007'),
  '40000000-0000-0000-0000-00000000000a'::uuid, 'Murid baru masuk tenant A');
select is((select full_name from public.profiles where id = '41000000-0000-0000-0000-000000000007'),
  'Murid Baru', 'Nama di-trim');
select throws_ok($$select public.create_school_user('41000000-0000-0000-0000-000000000008', 'student', 'Dobel', '100')$$,
  '23505', null, 'NIS duplikat di sekolah yang sama ditolak');
select throws_ok($$select public.create_school_user('41000000-0000-0000-0000-000000000008', 'school_admin', 'Naik', null)$$,
  '22023', null, 'Tidak bisa membuat Admin Sekolah');
select lives_ok($$select public.create_school_user('41000000-0000-0000-0000-000000000008', 'teacher', 'Guru Baru', '')$$,
  'Admin A: buat guru tanpa NIP');
select is((select count(*)::int from public.audit_logs
  where record_id = '41000000-0000-0000-0000-000000000007' and actor_id = '41000000-0000-0000-0000-000000000001'),
  1, 'Pembuatan akun tercatat atas nama Admin A');

-- Ubah & nonaktifkan --------------------------------------------------------------------
select public.update_school_user('41000000-0000-0000-0000-000000000003', 'Murid A Edit', '999');
select results_eq($$select full_name, nis_nip from public.profiles where id = '41000000-0000-0000-0000-000000000003'$$,
  $$values ('Murid A Edit'::text, '100'::text)$$, 'Ubah murid: nama berubah, NIS tetap');
select public.update_school_user('41000000-0000-0000-0000-000000000002', 'Guru A', 'G2');
select is((select nis_nip from public.profiles where id = '41000000-0000-0000-0000-000000000002'), 'G2',
  'Ubah guru: NIP berubah');
select throws_ok($$select public.update_school_user('41000000-0000-0000-0000-000000000004', 'Diretas', null)$$,
  'P0002', null, 'Admin A tidak bisa mengubah murid sekolah B');
select throws_ok($$select public.set_school_user_active('41000000-0000-0000-0000-000000000006', false)$$,
  'P0002', null, 'Admin A tidak bisa menonaktifkan sesama Admin Sekolah');
select lives_ok($$select public.set_school_user_active('41000000-0000-0000-0000-000000000003', false)$$,
  'Admin A: nonaktifkan murid');
select is((select count(*)::int from public.teacher_emails()), 2, 'teacher_emails: guru sekolah A');

-- Akun nonaktif: tidak ada akses data -----------------------------------------------------
select pg_temp.login_as('41000000-0000-0000-0000-000000000003');
select ok(not public.tenant_is_active(), 'Murid nonaktif: tenant_is_active false');
select is((select count(*)::int from public.profiles), 0, 'Murid nonaktif: 0 profil (termasuk diri sendiri)');

-- Peran lain ditolak ----------------------------------------------------------------------
select pg_temp.login_as('41000000-0000-0000-0000-000000000002');
select throws_ok($$select public.create_school_user('41000000-0000-0000-0000-000000000009', 'student', 'X', '300')$$,
  '42501', null, 'Guru tidak bisa membuat akun');
select is((select count(*)::int from public.teacher_emails()), 0, 'Guru: teacher_emails kosong');

select pg_temp.login_as('41000000-0000-0000-0000-000000000005');
select throws_ok($$select public.create_school_user('41000000-0000-0000-0000-000000000009', 'student', 'X', '300')$$,
  '42501', null, 'Admin sekolah nonaktif tidak bisa membuat akun');

reset role;
set local role anon;
select throws_ok($$select public.create_school_user('41000000-0000-0000-0000-000000000009', 'student', 'X', '300')$$,
  '42501', null, 'anon: ditolak');

select * from finish();
rollback;
