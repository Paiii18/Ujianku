-- F1.9 — mark_payment_paid() + aturan tulis subscriptions
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into public.tenants (id, code, name, status, active_until) values
  ('00000000-0000-0000-0000-00000000000a', 'MASIHAKTIF', 'Masih aktif', 'active', now() + interval '10 days'),
  ('00000000-0000-0000-0000-00000000000b', 'SUDAHHABIS', 'Sudah habis', 'inactive', now() - interval '5 days'),
  ('00000000-0000-0000-0000-00000000000c', 'BARUDAFTAR', 'Baru daftar', 'inactive', null);

insert into public.subscriptions (id, tenant_id, amount) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 500000),
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 500000),
  ('20000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', 500000),
  ('20000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000c', 450000),
  ('20000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000000c', 450000);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'sa@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'admin.a@test.local');
insert into public.profiles (id, tenant_id, role, full_name) values
  ('10000000-0000-0000-0000-000000000001', null, 'super_admin', 'SA'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Bukan Super Admin ------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$select public.mark_payment_paid('20000000-0000-0000-0000-00000000000a')$$,
  '42501', null, 'Admin Sekolah tidak bisa menandai lunas');

-- Super Admin ------------------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');

select is(public.mark_payment_paid('20000000-0000-0000-0000-00000000000a'),
  now() + interval '10 days' + interval '1 month',
  'Masih aktif: diperpanjang dari active_until lama');
select is(public.mark_payment_paid('20000000-0000-0000-0000-00000000000b'),
  now() + interval '1 month',
  'Sudah habis: dihitung dari sekarang');
select is(public.mark_payment_paid('20000000-0000-0000-0000-00000000000c'),
  now() + interval '1 month',
  'Belum pernah aktif: dihitung dari sekarang');

select results_eq(
  $$select status::text, active_until from public.tenants
    where id = '00000000-0000-0000-0000-00000000000b'$$,
  $$values ('active', now() + interval '1 month')$$,
  'Sekolah habis langsung aktif kembali');
select results_eq(
  $$select status::text, period_start, period_end, paid_at from public.subscriptions
    where id = '20000000-0000-0000-0000-00000000000b'$$,
  $$values ('paid', (now() at time zone 'Asia/Jakarta')::date,
            ((now() + interval '1 month') at time zone 'Asia/Jakarta')::date, now())$$,
  'Periode & tanggal lunas terisi');

select throws_ok($$select public.mark_payment_paid('20000000-0000-0000-0000-00000000000a')$$,
  'P0001', null, 'Tidak bisa melunasi dua kali');
select throws_ok($$select public.mark_payment_paid('20000000-0000-0000-0000-999999999999')$$,
  'P0002', null, 'Pembayaran tidak dikenal ditolak');

select is(
  (select count(*)::int from public.audit_logs
   where actor_id = '10000000-0000-0000-0000-000000000001'
     and record_id in ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b')),
  2, 'Lunas tercatat di audit_logs (subscriptions + tenants)');

-- Tulis langsung dari aplikasi -------------------------------------------------
select lives_ok($$insert into public.subscriptions (tenant_id, amount)
  values ('00000000-0000-0000-0000-00000000000a', 0)$$, 'SA bisa mencatat pembayaran pending');
select throws_ok($$insert into public.subscriptions (tenant_id, amount, status, period_start, period_end, paid_at)
  values ('00000000-0000-0000-0000-00000000000a', 1, 'paid', current_date, current_date + 30, now())$$,
  '42501', null, 'Insert langsung berstatus paid ditolak');

update public.subscriptions set status = 'cancelled' where id = '20000000-0000-0000-0000-0000000000c2';
select is((select status::text from public.subscriptions where id = '20000000-0000-0000-0000-0000000000c2'),
  'cancelled', 'Pending bisa dibatalkan');

select throws_ok($$update public.subscriptions set status = 'paid', period_start = current_date,
  period_end = current_date + 30, paid_at = now() where id = '20000000-0000-0000-0000-0000000000c3'$$,
  '42501', null, 'Ubah langsung ke paid ditolak');

update public.subscriptions set status = 'cancelled' where id = '20000000-0000-0000-0000-00000000000a';
select is((select status::text from public.subscriptions where id = '20000000-0000-0000-0000-00000000000a'),
  'paid', 'Pembayaran lunas tidak bisa dibatalkan');

select * from finish();
rollback;
