-- F1.1 — constraint tabel fondasi
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into public.tenants (id, code, name) values
  ('00000000-0000-0000-0000-00000000000a', 'SEKOLAHA', 'Sekolah A'),
  ('00000000-0000-0000-0000-00000000000b', 'SEKOLAHB', 'Sekolah B');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'm1@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'm2@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'm3@test.local'),
  ('10000000-0000-0000-0000-000000000004', 'sa@test.local');

select lives_ok(
  $$insert into public.profiles (id, tenant_id, role, full_name, nis_nip)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'student', 'Murid 1', '1001')$$,
  'murid dengan NIS bisa dibuat'
);

select throws_ok(
  $$insert into public.profiles (id, tenant_id, role, full_name, nis_nip)
    values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'student', 'Murid 2', '1001')$$,
  '23505', null,
  'NIS duplikat di sekolah yang sama ditolak'
);

select lives_ok(
  $$insert into public.profiles (id, tenant_id, role, full_name, nis_nip)
    values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b', 'student', 'Murid 2', '1001')$$,
  'NIS sama di sekolah lain diizinkan'
);

select throws_ok(
  $$insert into public.profiles (id, tenant_id, role, full_name)
    values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'student', 'Tanpa NIS')$$,
  '23514', null,
  'murid tanpa NIS ditolak'
);

select throws_ok(
  $$insert into public.profiles (id, role, full_name)
    values ('10000000-0000-0000-0000-000000000003', 'teacher', 'Guru tanpa sekolah')$$,
  '23514', null,
  'peran sekolah tanpa tenant ditolak'
);

select throws_ok(
  $$insert into public.profiles (id, tenant_id, role, full_name)
    values ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000000a', 'super_admin', 'SA')$$,
  '23514', null,
  'super admin dengan tenant ditolak'
);

select throws_ok(
  $$insert into public.tenants (code, name) values ('sman1', 'Huruf kecil')$$,
  '23514', null,
  'kode sekolah harus huruf besar/angka'
);

select throws_ok(
  $$insert into public.subscriptions (tenant_id, amount, status)
    values ('00000000-0000-0000-0000-00000000000a', 100000, 'paid')$$,
  '23514', null,
  'langganan lunas tanpa periode ditolak'
);

select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.tenants'::regclass, 'public.subscriptions'::regclass, 'public.profiles'::regclass)),
  'RLS aktif di semua tabel fondasi'
);

select * from finish();
rollback;
