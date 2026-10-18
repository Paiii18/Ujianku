-- F2.14 — import_questions: banyak soal dalam satu transaksi lewat save_question
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into public.tenants (id, code, name, status, active_until) values
  ('a9000000-0000-0000-0000-00000000000a', 'IMPQA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('a9000000-0000-0000-0000-00000000000b', 'IMPQB', 'Sekolah B', 'active', now() + interval '30 days'),
  ('a9000000-0000-0000-0000-00000000000c', 'IMPQC', 'Sekolah C', 'inactive', now() - interval '1 day');

insert into auth.users (id, email)
select ('a9100000-0000-0000-0000-00000000000' || n)::uuid, 'imp' || n || '@test.local'
from generate_series(1, 5) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('a9100000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', 'G1'),
  ('a9100000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('a9100000-0000-0000-0000-000000000003', 'a9000000-0000-0000-0000-00000000000a', 'student', 'Murid A', '001'),
  ('a9100000-0000-0000-0000-000000000004', 'a9000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1'),
  ('a9100000-0000-0000-0000-000000000005', 'a9000000-0000-0000-0000-00000000000c', 'teacher', 'Guru C', 'G1');

insert into public.subjects (id, tenant_id, code, name) values
  ('a9300000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika'),
  ('a9300000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-00000000000b', 'MTK', 'Matematika'),
  ('a9300000-0000-0000-0000-000000000003', 'a9000000-0000-0000-0000-00000000000c', 'MTK', 'Matematika');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Payload valid: PG bergambar, isian, menjodohkan, multi essay (2 sub-soal)
create function pg_temp.valid(p_subject uuid default 'a9300000-0000-0000-0000-000000000001') returns jsonb
language sql as $$
  select jsonb_build_array(
    jsonb_build_object('row', 2, 'id', 'a9400000-0000-0000-0000-000000000001', 'subject_id', p_subject,
      'type', 'multiple_choice', 'content', '12 × 8 = ...', 'points', 2, 'explanation', '96',
      'image_path', 'a9000000-0000-0000-0000-00000000000a/a9400000-0000-0000-0000-000000000001/soal.png',
      'options', jsonb_build_array(
        jsonb_build_object('label', 'A', 'content', '96', 'image_path', null, 'is_correct', true),
        jsonb_build_object('label', 'B', 'content', '', 'is_correct', false,
          'image_path', 'a9000000-0000-0000-0000-00000000000a/a9400000-0000-0000-0000-000000000001/opsi-b.png'))),
    jsonb_build_object('row', 3, 'id', 'a9400000-0000-0000-0000-000000000002', 'subject_id', p_subject,
      'type', 'short_answer', 'content', 'Ibu kota?', 'points', 1, 'answers', jsonb_build_array('Jakarta', 'DKI Jakarta')),
    jsonb_build_object('row', 4, 'id', 'a9400000-0000-0000-0000-000000000003', 'subject_id', p_subject,
      'type', 'matching', 'content', 'Pasangkan', 'points', 3,
      'pairs', jsonb_build_array(jsonb_build_object('left', 'Jakarta', 'right', 'Indonesia'),
                                 jsonb_build_object('left', 'Tokyo', 'right', 'Jepang'))),
    jsonb_build_object('row', 5, 'id', 'a9400000-0000-0000-0000-000000000004', 'subject_id', p_subject,
      'type', 'multi_essay', 'content', 'Bacalah teks', 'points', 0,
      'subs', jsonb_build_array(
        jsonb_build_object('content', 'Gagasan utama?', 'answer_key', 'x', 'keywords', jsonb_build_array('a'), 'points', 2),
        jsonb_build_object('content', 'Tokoh?', 'answer_key', 'y', 'points', 1.5)))
  );
$$;

set local role authenticated;

-- Peran & tenant --------------------------------------------------------------------
select pg_temp.login_as('a9100000-0000-0000-0000-000000000002');
select throws_ok($$select public.import_questions(pg_temp.valid())$$, '42501', null, 'Admin Sekolah ditolak');
select pg_temp.login_as('a9100000-0000-0000-0000-000000000003');
select throws_ok($$select public.import_questions(pg_temp.valid())$$, '42501', null, 'Murid ditolak');
select pg_temp.login_as('a9100000-0000-0000-0000-000000000005');
select throws_ok($$select public.import_questions(pg_temp.valid('a9300000-0000-0000-0000-000000000003'))$$,
  '42501', null, 'Guru sekolah nonaktif ditolak');

-- Sukses ------------------------------------------------------------------------------
select pg_temp.login_as('a9100000-0000-0000-0000-000000000001');
select is(public.import_questions(pg_temp.valid()), 4, 'Mengembalikan jumlah soal (tanpa sub-soal)');
select is((select count(*)::int from public.questions where parent_id is null), 4, '4 soal induk tersimpan');
select is((select count(*)::int from public.questions
  where parent_id = 'a9400000-0000-0000-0000-000000000004'), 2, '2 sub-soal tersimpan');
select is((select points from public.questions where id = 'a9400000-0000-0000-0000-000000000004'), 3.50::numeric,
  'Poin multi essay = jumlah sub-soal');
select is((select image_path from public.question_options where label = 'B'),
  'a9000000-0000-0000-0000-00000000000a/a9400000-0000-0000-0000-000000000001/opsi-b.png', 'Gambar opsi tersimpan');
select is((select count(*)::int from public.question_pairs where question_id = 'a9400000-0000-0000-0000-000000000003'),
  2, 'Pasangan tersimpan');
select is((select count(distinct created_by)::int from public.questions), 1, 'Semua milik guru pengimport');

-- Satu error = tidak ada yang tersimpan --------------------------------------------------
delete from public.questions;
select throws_ok($$select public.import_questions(
  jsonb_set(pg_temp.valid(), '{2,pairs}', '[{"left": "A", "right": "1"}]'))$$,
  '22023', 'Baris 4: Soal menjodohkan harus punya 2–10 pasangan', 'Pesan error menyebut baris Excel');
select is((select count(*)::int from public.questions), 0, 'Soal valid sebelum baris error ikut dibatalkan');

select throws_ok($$select public.import_questions(
  jsonb_set(pg_temp.valid(), '{0,image_path}', '"a9000000-0000-0000-0000-00000000000a/lain/soal.png"'))$$,
  '22023', null, 'Path gambar di luar folder soal ditolak');
select throws_ok($$select public.import_questions(pg_temp.valid('a9300000-0000-0000-0000-000000000002'))$$,
  null, null, 'Mapel sekolah lain ditolak');
select is((select count(*)::int from public.questions), 0, 'Tidak ada soal tersimpan setelah import gagal');

select throws_ok($$select public.import_questions(
  (select jsonb_agg(pg_temp.valid() -> 1 || jsonb_build_object('id', gen_random_uuid())) from generate_series(1, 501)))$$,
  '22023', 'Import berisi 1–500 soal', 'Lebih dari 500 soal ditolak');

select * from finish();
rollback;
