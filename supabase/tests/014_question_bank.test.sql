-- F2.7 — bank soal: guru kelola miliknya, guru lain & Admin Sekolah baca, murid tanpa akses
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Fixture (sebagai postgres, tanpa RLS) -------------------------------------------
insert into public.tenants (id, code, name, status, active_until) values
  ('70000000-0000-0000-0000-00000000000a', 'SOALA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('70000000-0000-0000-0000-00000000000b', 'SOALB', 'Sekolah B', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('71000000-0000-0000-0000-00000000000' || n)::uuid, 'q' || n || '@test.local'
from generate_series(1, 6) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('71000000-0000-0000-0000-000000000001', null, 'super_admin', 'SA', null),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A1', 'G1'),
  ('71000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A2', 'G2'),
  ('71000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-00000000000a', 'student', 'Murid A', '1'),
  ('71000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1');

insert into public.subjects (id, tenant_id, code, name) values
  ('73000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika'),
  ('73000000-0000-0000-0000-0000000000a2', '70000000-0000-0000-0000-00000000000a', 'BIO', 'Biologi'),
  ('73000000-0000-0000-0000-0000000000b1', '70000000-0000-0000-0000-00000000000b', 'MTK', 'Matematika');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Guru A1 membuat soal ------------------------------------------------------------
select pg_temp.login_as('71000000-0000-0000-0000-000000000003');

select lives_ok($$
  insert into public.questions (id, subject_id, type, content) values
    ('74000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-0000000000a1', 'multiple_choice', '12 × 8 = ...'),
    ('74000000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-0000000000a1', 'matching', 'Jodohkan'),
    ('74000000-0000-0000-0000-000000000003', '73000000-0000-0000-0000-0000000000a1', 'multi_essay', 'Bacaan')
$$, 'Guru membuat soal');
select is(
  (select tenant_id::text || '/' || created_by::text from public.questions where id = '74000000-0000-0000-0000-000000000001'),
  '70000000-0000-0000-0000-00000000000a/71000000-0000-0000-0000-000000000003',
  'tenant_id & created_by diisi otomatis'
);
select is((select points from public.questions where id = '74000000-0000-0000-0000-000000000003'), 1.00::numeric,
  'Poin default 1');
select lives_ok($$
  insert into public.question_options (question_id, label, content, is_correct) values
    ('74000000-0000-0000-0000-000000000001', 'A', '96', true),
    ('74000000-0000-0000-0000-000000000001', 'B', '86', false)
$$, 'Guru menambah opsi soalnya');
select lives_ok($$
  insert into public.question_pairs (question_id, left_text, right_text) values
    ('74000000-0000-0000-0000-000000000002', 'Jakarta', 'Indonesia'),
    ('74000000-0000-0000-0000-000000000002', 'Tokyo', 'Jepang')
$$, 'Guru menambah pasangan soalnya');
select lives_ok($$update public.questions set content = '12 × 8 adalah ...' where id = '74000000-0000-0000-0000-000000000001'$$,
  'Guru mengubah soalnya');

-- Constraint ----------------------------------------------------------------------
select throws_ok($$insert into public.questions (subject_id, type, content, points)
  values ('73000000-0000-0000-0000-0000000000a1', 'essay', 'X', 0)$$,
  '23514', null, 'Poin 0 hanya untuk induk multi essay');
select lives_ok($$update public.questions set points = 0 where id = '74000000-0000-0000-0000-000000000003'$$,
  'Induk multi essay boleh poin 0');
select throws_ok($$insert into public.question_options (question_id, label) values ('74000000-0000-0000-0000-000000000001', 'F')$$,
  '23514', null, 'Label opsi hanya A–E');
select lives_ok($$
  insert into public.questions (id, subject_id, parent_id, position, type, content) values
    ('74000000-0000-0000-0000-000000000004', '73000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-000000000003', 1, 'essay', 'Sub 1')
$$, 'Sub-soal essay di bawah multi essay');
select throws_ok($$insert into public.questions (subject_id, parent_id, type, content)
  values ('73000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-000000000001', 'essay', 'X')$$,
  '23514', null, 'Induk bukan multi essay ditolak');
select throws_ok($$insert into public.questions (subject_id, parent_id, type, content)
  values ('73000000-0000-0000-0000-0000000000a2', '74000000-0000-0000-0000-000000000003', 'essay', 'X')$$,
  '23514', null, 'Sub-soal beda mapel ditolak');
select throws_ok($$insert into public.questions (subject_id, parent_id, type, content)
  values ('73000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-000000000003', 'multiple_choice', 'X')$$,
  '23514', null, 'Sub-soal selain essay ditolak');
select throws_ok($$insert into public.questions (subject_id, type, content)
  values ('73000000-0000-0000-0000-0000000000b1', 'essay', 'X')$$,
  '23503', null, 'Mapel sekolah lain ditolak (FK komposit)');

-- Guru A2: baca saja --------------------------------------------------------------
select pg_temp.login_as('71000000-0000-0000-0000-000000000004');

select is((select count(*)::int from public.questions), 4, 'Guru lain membaca soal sekolahnya');
select is((select count(*)::int from public.question_options), 2, 'Guru lain membaca opsi');
update public.questions set content = 'diubah' where id = '74000000-0000-0000-0000-000000000001';
delete from public.questions where id = '74000000-0000-0000-0000-000000000002';
delete from public.question_pairs;
select is(
  (select count(*)::int from public.questions where content = 'diubah')
  + (select count(*)::int from public.question_pairs where question_id = '74000000-0000-0000-0000-000000000002'),
  2, 'Guru lain tidak bisa mengubah/menghapus soal & pasangan orang lain'
);
select throws_ok($$insert into public.question_options (question_id, label) values ('74000000-0000-0000-0000-000000000001', 'C')$$,
  '42501', null, 'Guru lain tidak bisa menambah opsi');
select throws_ok($$insert into public.questions (subject_id, created_by, type, content)
  values ('73000000-0000-0000-0000-0000000000a1', '71000000-0000-0000-0000-000000000003', 'essay', 'X')$$,
  '42501', null, 'Tidak bisa membuat soal atas nama guru lain');
select throws_ok($$insert into public.questions (subject_id, parent_id, type, content)
  values ('73000000-0000-0000-0000-0000000000a1', '74000000-0000-0000-0000-000000000003', 'essay', 'X')$$,
  '23514', null, 'Tidak bisa menambah sub-soal ke multi essay guru lain');

-- Admin Sekolah: baca saja (DEC-028) ------------------------------------------------
select pg_temp.login_as('71000000-0000-0000-0000-000000000002');

select is((select count(*)::int from public.questions), 4, 'Admin Sekolah membaca soal sekolahnya');
select is((select count(*)::int from public.question_pairs), 2, 'Admin Sekolah membaca pasangan');
select throws_ok($$insert into public.questions (subject_id, created_by, type, content)
  values ('73000000-0000-0000-0000-0000000000a1', '71000000-0000-0000-0000-000000000003', 'essay', 'X')$$,
  '42501', null, 'Admin Sekolah tidak bisa membuat soal');
update public.questions set content = 'diubah admin';
select is((select count(*)::int from public.questions where content = 'diubah admin'), 0,
  'Admin Sekolah tidak bisa mengubah soal');

-- Murid: tanpa akses sama sekali --------------------------------------------------
select pg_temp.login_as('71000000-0000-0000-0000-000000000005');

select is((select count(*)::int from public.questions), 0, 'Murid tidak bisa SELECT soal');
select is((select count(*)::int from public.question_options), 0, 'Murid tidak bisa SELECT opsi (kunci)');
select is((select count(*)::int from public.question_pairs), 0, 'Murid tidak bisa SELECT pasangan');
select is((select count(*)::int from public.import_jobs), 0, 'Murid tidak bisa SELECT import_jobs');

-- Sekolah lain & Super Admin --------------------------------------------------------
select pg_temp.login_as('71000000-0000-0000-0000-000000000006');

select is((select count(*)::int from public.questions) + (select count(*)::int from public.question_options), 0,
  'Guru sekolah lain tidak melihat soal & opsi sekolah A');

select pg_temp.login_as('71000000-0000-0000-0000-000000000001');

select is((select count(*)::int from public.questions where tenant_id = '70000000-0000-0000-0000-00000000000a'), 4,
  'Super Admin membaca soal');

-- import_jobs ---------------------------------------------------------------------
select pg_temp.login_as('71000000-0000-0000-0000-000000000003');

select lives_ok($$insert into public.import_jobs (file_name) values ('soal.xlsx')$$, 'Guru mencatat import');
delete from public.import_jobs;
select is((select count(*)::int from public.import_jobs), 1, 'Riwayat import tidak bisa dihapus');

select pg_temp.login_as('71000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.import_jobs), 0, 'Guru lain tidak melihat import orang lain');

select pg_temp.login_as('71000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.import_jobs), 1, 'Admin Sekolah melihat riwayat import');
select throws_ok($$insert into public.import_jobs (file_name, uploaded_by)
  values ('x.xlsx', '71000000-0000-0000-0000-000000000003')$$,
  '42501', null, 'Admin Sekolah tidak bisa mencatat import');

-- Hapus induk multi essay → sub-soal ikut terhapus ----------------------------------
select pg_temp.login_as('71000000-0000-0000-0000-000000000003');
delete from public.questions where id = '74000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.questions where id = '74000000-0000-0000-0000-000000000004'), 0,
  'Sub-soal ikut terhapus bersama induknya');
delete from public.questions where id = '74000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.question_options where question_id = '74000000-0000-0000-0000-000000000001'), 0,
  'Opsi ikut terhapus bersama soalnya');

select * from finish();
rollback;
