-- F1.8 — create_school() + audit_logs (trigger & RLS)
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into public.tenants (id, code, name, status, active_until) values
  ('00000000-0000-0000-0000-00000000000a', 'AKTIFA', 'Sekolah A', 'active', now() + interval '10 days'),
  ('00000000-0000-0000-0000-00000000000b', 'AKTIFB', 'Sekolah B', 'active', now() + interval '10 days');

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'sa@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'admin.a@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'guru.a@test.local'),
  ('10000000-0000-0000-0000-000000000004', 'admin.baru@test.local'),
  ('10000000-0000-0000-0000-000000000005', 'admin.dup@test.local');

insert into public.profiles (id, tenant_id, role, full_name) values
  ('10000000-0000-0000-0000-000000000001', null, 'super_admin', 'SA'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A');

-- Fixture di atas dibuat tanpa user login → aksi sistem (actor NULL)
select is(
  (select count(*)::int from public.audit_logs
   where tenant_id = '00000000-0000-0000-0000-00000000000a' and actor_id is null),
  3, 'Insert fixture tercatat sebagai aksi sistem (1 tenant + 2 profil)'
);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Super Admin membuat sekolah --------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');

select lives_ok(
  $$select public.create_school('BARU01', 'Sekolah Baru', '10000000-0000-0000-0000-000000000004', 'Admin Baru')$$,
  'SA bisa membuat sekolah + admin'
);
select results_eq(
  $$select t.status::text, p.role::text, p.full_name from public.tenants t
    join public.profiles p on p.tenant_id = t.id where t.code = 'BARU01'$$,
  $$values ('inactive', 'school_admin', 'Admin Baru')$$,
  'Sekolah baru nonaktif (DEC-009) dengan satu Admin Sekolah'
);
select results_eq(
  $$select action from public.audit_logs
    where tenant_id = (select id from public.tenants where code = 'BARU01')
      and actor_id = '10000000-0000-0000-0000-000000000001' order by id$$,
  $$values ('tenants.insert'), ('profiles.insert')$$,
  'Pembuatan sekolah tercatat di audit_logs atas nama SA'
);

select throws_ok(
  $$select public.create_school('BARU01', 'Duplikat', '10000000-0000-0000-0000-000000000005', 'Admin Dup')$$,
  '23505', null, 'Kode sekolah duplikat ditolak'
);
select is(
  (select count(*)::int from public.profiles where id = '10000000-0000-0000-0000-000000000005'),
  0, 'Kode duplikat: profil admin tidak ikut tersimpan (satu transaksi)'
);

update public.tenants set name = 'Sekolah Baru (ubah)' where code = 'BARU01';
select results_eq(
  $$select old_value ->> 'name', new_value ->> 'name' from public.audit_logs
    where action = 'tenants.update' and actor_id = '10000000-0000-0000-0000-000000000001'$$,
  $$values ('Sekolah Baru', 'Sekolah Baru (ubah)')$$,
  'Ubah nama tercatat dengan nilai lama & baru'
);

update public.tenants set name = 'Sekolah Baru (ubah)' where code = 'BARU01';
select is(
  (select count(*)::int from public.audit_logs where action = 'tenants.update'
     and actor_id = '10000000-0000-0000-0000-000000000001'),
  1, 'Update tanpa perubahan tidak menambah log'
);

-- Selain Super Admin -----------------------------------------------------------
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');

select throws_ok(
  $$select public.create_school('LIAR01', 'Liar', '10000000-0000-0000-0000-000000000005', 'X')$$,
  '42501', null, 'Admin Sekolah tidak bisa membuat sekolah (RLS)'
);
select ok(
  (select count(*) > 0 from public.audit_logs)
  and not exists (select 1 from public.audit_logs
                  where tenant_id is distinct from '00000000-0000-0000-0000-00000000000a'),
  'Admin Sekolah A hanya melihat log sekolahnya'
);
select throws_ok(
  $$insert into public.audit_logs (action) values ('palsu')$$,
  '42501', null, 'User tidak bisa menulis audit_logs langsung'
);

select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
select is_empty('select * from public.audit_logs', 'Guru tidak melihat audit_logs');

select * from finish();
rollback;
