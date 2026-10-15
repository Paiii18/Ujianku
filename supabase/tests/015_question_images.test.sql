-- F2.8 — policy bucket question-images
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.tenants (id, code, name, status, active_until) values
  ('80000000-0000-0000-0000-00000000000a', 'IMGA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('80000000-0000-0000-0000-00000000000b', 'IMGB', 'Sekolah B', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('81000000-0000-0000-0000-00000000000' || n)::uuid, 'm' || n || '@test.local'
from generate_series(1, 5) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A1', 'G1'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A2', 'G2'),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-00000000000a', 'student', 'Murid A', '1'),
  ('81000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1');

insert into public.subjects (id, tenant_id, code, name) values
  ('83000000-0000-0000-0000-0000000000a1', '80000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika');
insert into public.questions (id, tenant_id, subject_id, created_by, type, content) values
  ('84000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-00000000000a',
   '83000000-0000-0000-0000-0000000000a1', '81000000-0000-0000-0000-000000000001', 'essay', 'Soal A1');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Guru A1 --------------------------------------------------------------------------
select pg_temp.login_as('81000000-0000-0000-0000-000000000001');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('question-images',
  '80000000-0000-0000-0000-00000000000a/84000000-0000-0000-0000-000000000001/a.png', '81000000-0000-0000-0000-000000000001')$$,
  'Guru mengunggah ke folder soalnya');
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('question-images',
  '80000000-0000-0000-0000-00000000000a/84000000-0000-0000-0000-0000000000ff/b.png', '81000000-0000-0000-0000-000000000001')$$,
  'Guru mengunggah ke folder soal yang belum disimpan (import ZIP)');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('question-images',
  '80000000-0000-0000-0000-00000000000b/84000000-0000-0000-0000-000000000001/c.png')$$,
  '42501', null, 'Unggah ke folder sekolah lain ditolak');

-- Guru A2 --------------------------------------------------------------------------
select pg_temp.login_as('81000000-0000-0000-0000-000000000002');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('question-images',
  '80000000-0000-0000-0000-00000000000a/84000000-0000-0000-0000-000000000001/d.png')$$,
  '42501', null, 'Unggah ke folder soal guru lain ditolak');
select is((select count(*)::int from storage.objects where bucket_id = 'question-images'), 2,
  'Guru lain sekolah sama bisa melihat gambar');
-- DELETE langsung ke storage.objects diblokir Storage; hapus diuji lewat Storage API (e2e)
update storage.objects set name = name || 'x' where bucket_id = 'question-images';
select is((select count(*)::int from storage.objects where bucket_id = 'question-images' and name like '%.png'), 2,
  'Guru lain tidak bisa mengganti gambar');

-- Admin Sekolah, murid, sekolah lain ---------------------------------------------------
select pg_temp.login_as('81000000-0000-0000-0000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id = 'question-images'), 2, 'Admin Sekolah melihat gambar');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('question-images',
  '80000000-0000-0000-0000-00000000000a/84000000-0000-0000-0000-0000000000fe/e.png')$$,
  '42501', null, 'Admin Sekolah tidak bisa mengunggah');

select pg_temp.login_as('81000000-0000-0000-0000-000000000004');
select is((select count(*)::int from storage.objects where bucket_id = 'question-images'), 0, 'Murid tidak melihat gambar');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('question-images',
  '80000000-0000-0000-0000-00000000000a/84000000-0000-0000-0000-0000000000fd/f.png')$$,
  '42501', null, 'Murid tidak bisa mengunggah');

select pg_temp.login_as('81000000-0000-0000-0000-000000000005');
select is((select count(*)::int from storage.objects where bucket_id = 'question-images'), 0,
  'Guru sekolah lain tidak melihat gambar');

select * from finish();
rollback;
