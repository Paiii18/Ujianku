-- F1.10 — run_subscription_check() dengan tanggal simulasi + notifications RLS + jadwal pg_cron
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Sekolah seed dikeluarkan dari hitungan (masa aktifnya relatif terhadap waktu db reset)
update public.tenants set status = 'inactive' where id::text not like '00000000-%';

-- "Sekarang" simulasi: 15-10-2026 10:00 WIB
insert into public.tenants (id, code, name, status, active_until) values
  ('00000000-0000-0000-0000-0000000000a7', 'HMIN7', 'Sisa 7 hari', 'active', '2026-10-22 08:00+07'),
  ('00000000-0000-0000-0000-0000000000a3', 'HMIN3', 'Sisa 3 hari', 'active', '2026-10-18 23:00+07'),
  ('00000000-0000-0000-0000-0000000000a1', 'HMIN1', 'Sisa 1 hari', 'active', '2026-10-16 00:30+07'),
  ('00000000-0000-0000-0000-0000000000a5', 'HMIN5', 'Sisa 5 hari', 'active', '2026-10-20 10:00+07'),
  ('00000000-0000-0000-0000-0000000000e0', 'LEWAT', 'Sudah lewat', 'active', '2026-10-15 09:59+07'),
  ('00000000-0000-0000-0000-0000000000f0', 'SUDAHNON', 'Sudah nonaktif', 'inactive', '2026-10-01 00:00+07');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000007', 'admin7@test.local'),
  ('10000000-0000-0000-0000-000000000077', 'admin7b@test.local'),
  ('10000000-0000-0000-0000-000000000078', 'admin7-nonaktif@test.local'),
  ('10000000-0000-0000-0000-000000000079', 'guru7@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'admin3@test.local'),
  ('10000000-0000-0000-0000-000000000001', 'admin1@test.local'),
  ('10000000-0000-0000-0000-000000000005', 'admin5@test.local');

insert into public.profiles (id, tenant_id, role, full_name, nis_nip, is_active) values
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-0000000000a7', 'school_admin', 'Admin 7', null, true),
  ('10000000-0000-0000-0000-000000000077', '00000000-0000-0000-0000-0000000000a7', 'school_admin', 'Admin 7b', null, true),
  ('10000000-0000-0000-0000-000000000078', '00000000-0000-0000-0000-0000000000a7', 'school_admin', 'Admin 7 nonaktif', null, false),
  ('10000000-0000-0000-0000-000000000079', '00000000-0000-0000-0000-0000000000a7', 'teacher', 'Guru 7', 'G7', true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a3', 'school_admin', 'Admin 3', null, true),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'school_admin', 'Admin 1', null, true),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-0000000000a5', 'school_admin', 'Admin 5', null, true);

select results_eq(
  $$select * from public.run_subscription_check('2026-10-15 10:00+07')$$,
  $$values (4, 1)$$,
  'Hari ke-1: 4 pengingat (H-7 x2 admin, H-3, H-1), 1 sekolah dinonaktifkan');

select results_eq(
  $$select user_id, title from public.notifications
    where type = 'subscription_expiring' and user_id::text like '10000000-%' order by user_id$$,
  $$values ('10000000-0000-0000-0000-000000000001'::uuid, 'Langganan berakhir dalam 1 hari'),
           ('10000000-0000-0000-0000-000000000003'::uuid, 'Langganan berakhir dalam 3 hari'),
           ('10000000-0000-0000-0000-000000000007'::uuid, 'Langganan berakhir dalam 7 hari'),
           ('10000000-0000-0000-0000-000000000077'::uuid, 'Langganan berakhir dalam 7 hari')$$,
  'Hanya Admin Sekolah aktif yang menerima (bukan guru / admin nonaktif / sisa 5 hari)');

select results_eq(
  $$select code, status::text from public.tenants
    where code in ('LEWAT', 'HMIN1', 'SUDAHNON') order by code$$,
  $$values ('HMIN1', 'active'), ('LEWAT', 'inactive'), ('SUDAHNON', 'inactive')$$,
  'Yang lewat masa aktif dinonaktifkan; yang belum lewat tetap aktif');

select results_eq(
  $$select actor_id, action from public.audit_logs
    where record_id = '00000000-0000-0000-0000-0000000000e0' and action = 'tenants.update'$$,
  $$values (null::uuid, 'tenants.update')$$,
  'Penonaktifan tercatat di audit_logs sebagai aksi sistem');

select results_eq(
  $$select * from public.run_subscription_check('2026-10-15 23:00+07')$$,
  $$values (0, 0)$$,
  'Dijalankan ulang di hari yang sama: tidak ada pengingat dobel');

select results_eq(
  $$select * from public.run_subscription_check('2026-10-16 00:05+07')$$,
  $$values (0, 0)$$,
  'Hari ke-2 00:05: H-6/H-2 tidak dapat pengingat; HMIN1 belum lewat (00:30)');

select results_eq(
  $$select * from public.run_subscription_check('2026-10-17 00:05+07')$$,
  $$values (2, 1)$$,
  'Hari ke-3: HMIN5 (H-3) & HMIN3 (H-1) diingatkan, HMIN1 dinonaktifkan');

-- RLS notifications ------------------------------------------------------------
create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- RLS memakai now() asli: pastikan HMIN7 aktif kapan pun tes dijalankan.
update public.tenants set active_until = now() + interval '7 days' where code = 'HMIN7';

set local role authenticated;
select pg_temp.login_as('10000000-0000-0000-0000-000000000007');
select results_eq('select user_id from public.notifications',
  $$values ('10000000-0000-0000-0000-000000000007'::uuid)$$,
  'Admin hanya melihat notifikasinya sendiri');
select throws_ok($$insert into public.notifications (user_id, type, title)
  values ('10000000-0000-0000-0000-000000000007', 'x', 'palsu')$$,
  '42501', null, 'User tidak bisa membuat notifikasi langsung');
select throws_ok($$select public.run_subscription_check()$$,
  '42501', null, 'User tidak bisa menjalankan cek langganan');

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select is_empty('select * from public.notifications',
  'Sekolah nonaktif (HMIN1): notifikasinya tidak terbaca');

reset role;
select results_eq(
  $$select schedule, command from cron.job where jobname = 'subscription-check'$$,
  $$values ('5 17 * * *'::text, 'select public.run_subscription_check()'::text)$$,
  'Job pg_cron terdaftar jam 00:05 WIB (17:05 UTC)');

select * from finish();
rollback;
