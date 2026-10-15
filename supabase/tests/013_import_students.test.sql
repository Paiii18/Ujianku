-- F2.4 — import_students + policy bucket imports
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.tenants (id, code, name, status, active_until) values
  ('60000000-0000-0000-0000-00000000000a', 'IMPA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('60000000-0000-0000-0000-00000000000b', 'IMPB', 'Sekolah B', 'active', now() + interval '30 days');

-- 1–3 punya profil; 4–9 akun Auth baru untuk diimport
insert into auth.users (id, email)
select ('61000000-0000-0000-0000-00000000000' || n)::uuid, 'i' || n || '@test.local'
from generate_series(1, 9) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', 'G1'),
  ('61000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-00000000000a', 'student', 'Lama', '500');

insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('62000000-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-00000000000a', '2026/2027', 1, true),
  ('62000000-0000-0000-0000-00000000000b', '60000000-0000-0000-0000-00000000000b', '2026/2027', 1, true);
insert into public.classes (id, tenant_id, academic_year_id, name, grade_level) values
  ('63000000-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-00000000000a', '62000000-0000-0000-0000-00000000000a', 'X-1', 10),
  ('63000000-0000-0000-0000-00000000000b', '60000000-0000-0000-0000-00000000000b', '62000000-0000-0000-0000-00000000000b', 'X-1', 10);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login_as('61000000-0000-0000-0000-000000000001');

-- Sukses: 2 murid, satu berkelas -------------------------------------------------------
select is(public.import_students($$[
  {"id": "61000000-0000-0000-0000-000000000004", "full_name": "Ani", "nis": "601", "class_id": "63000000-0000-0000-0000-00000000000a"},
  {"id": "61000000-0000-0000-0000-000000000005", "full_name": "Budi", "nis": "602", "class_id": null}
]$$::jsonb), 2, 'Import 2 murid');
select is((select count(*)::int from public.profiles where nis_nip in ('601', '602') and role = 'student'
  and tenant_id = '60000000-0000-0000-0000-00000000000a'), 2, 'Murid masuk tenant A sebagai student');
select is((select count(*)::int from public.class_students where student_id = '61000000-0000-0000-0000-000000000004'),
  1, 'Murid berkelas masuk kelasnya');

-- Gagal: satu baris salah = tidak ada yang tersimpan ------------------------------------
select throws_ok($$select public.import_students('[
  {"id": "61000000-0000-0000-0000-000000000006", "full_name": "Cici", "nis": "603", "class_id": null},
  {"id": "61000000-0000-0000-0000-000000000007", "full_name": "Dobel", "nis": "500", "class_id": null}
]'::jsonb)$$, '23505', null, 'NIS sudah ada → seluruh import gagal');
select is((select count(*)::int from public.profiles where nis_nip = '603'), 0, 'Baris valid ikut dibatalkan');

select throws_ok($$select public.import_students('[
  {"id": "61000000-0000-0000-0000-000000000008", "full_name": "Eka", "nis": "604", "class_id": "63000000-0000-0000-0000-00000000000b"}
]'::jsonb)$$, '23503', null, 'Kelas sekolah lain ditolak');
select is((select count(*)::int from public.profiles where nis_nip = '604'), 0, 'Profil murid ikut dibatalkan');

-- Peran lain ditolak -----------------------------------------------------------------
select pg_temp.login_as('61000000-0000-0000-0000-000000000002');
select throws_ok($$select public.import_students('[{"id": "61000000-0000-0000-0000-000000000009", "full_name": "X", "nis": "605", "class_id": null}]'::jsonb)$$,
  '42501', null, 'Guru tidak bisa import murid');

-- Storage: hanya folder {tenant}/{user} sendiri ----------------------------------------
select pg_temp.login_as('61000000-0000-0000-0000-000000000001');
select lives_ok($$insert into storage.objects (bucket_id, name)
  values ('imports', '60000000-0000-0000-0000-00000000000a/61000000-0000-0000-0000-000000000001/a.xlsx')$$,
  'Upload ke folder sendiri');
select throws_ok($$insert into storage.objects (bucket_id, name)
  values ('imports', '60000000-0000-0000-0000-00000000000b/61000000-0000-0000-0000-000000000001/a.xlsx')$$,
  '42501', null, 'Upload ke folder sekolah lain ditolak');

select * from finish();
rollback;
