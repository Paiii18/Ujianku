-- F2.12 — duplicate_question
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into public.tenants (id, code, name, status, active_until) values
  ('a9000000-0000-0000-0000-00000000000a', 'DUPA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('a9000000-0000-0000-0000-00000000000b', 'DUPB', 'Sekolah B', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('a9100000-0000-0000-0000-00000000000' || n)::uuid, 'd' || n || '@test.local'
from generate_series(1, 4) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('a9100000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 1', 'G1'),
  ('a9100000-0000-0000-0000-000000000002', 'a9000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 2', 'G2'),
  ('a9100000-0000-0000-0000-000000000003', 'a9000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin', null),
  ('a9100000-0000-0000-0000-000000000004', 'a9000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1');

insert into public.subjects (id, tenant_id, code, name) values
  ('a9300000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login_as('a9100000-0000-0000-0000-000000000001');

-- Sumber milik Guru 1: PG bergambar, menjodohkan, multi essay
select public.save_question('a9400000-0000-0000-0000-000000000001', 'a9300000-0000-0000-0000-000000000001',
  'multiple_choice', '12 × 8', 'a9000000-0000-0000-0000-00000000000a/a9400000-0000-0000-0000-000000000001/s.webp', 2, 'Kalikan',
  '[{"label": "A", "content": "96", "is_correct": true},
    {"label": "B", "content": "", "image_path": "a9000000-0000-0000-0000-00000000000a/a9400000-0000-0000-0000-000000000001/b.webp", "is_correct": false}]');
select public.save_question('a9400000-0000-0000-0000-000000000002', 'a9300000-0000-0000-0000-000000000001',
  'matching', 'Pasangkan', null, 3, null,
  p_pairs => '[{"left": "Jakarta", "right": "Indonesia"}, {"left": "Tokyo", "right": "Jepang"}]');
select public.save_question('a9400000-0000-0000-0000-000000000003', 'a9300000-0000-0000-0000-000000000001',
  'multi_essay', 'Bacalah', null, 0, null,
  p_subs => '[{"content": "S1", "answer_key": "A1", "keywords": ["k"], "points": 2},
              {"content": "S2", "answer_key": "A2", "keywords": [], "points": 1}]');

-- Guru 2 menduplikat soal Guru 1 ---------------------------------------------------------
select pg_temp.login_as('a9100000-0000-0000-0000-000000000002');

select is(public.duplicate_question('a9400000-0000-0000-0000-000000000001', 'a9500000-0000-0000-0000-000000000001'),
  'a9500000-0000-0000-0000-000000000001'::uuid, 'PG diduplikat guru lain');
select is((select created_by from public.questions where id = 'a9500000-0000-0000-0000-000000000001'),
  'a9100000-0000-0000-0000-000000000002'::uuid, 'Salinan milik guru yang menduplikat');
select is((select image_path || '|' || content || '|' || points || '|' || explanation from public.questions
  where id = 'a9500000-0000-0000-0000-000000000001'),
  'a9000000-0000-0000-0000-00000000000a/a9500000-0000-0000-0000-000000000001/s.webp|12 × 8|2.00|Kalikan',
  'Isi sama, gambar soal diarahkan ke folder baru');
select is((select string_agg(label || ':' || is_correct || ':' || coalesce(image_path, '-'), ',' order by label)
  from public.question_options where question_id = 'a9500000-0000-0000-0000-000000000001'),
  'A:true:-,B:false:a9000000-0000-0000-0000-00000000000a/a9500000-0000-0000-0000-000000000001/b.webp',
  'Opsi & kunci tersalin, gambar opsi diarahkan ke folder baru');

select lives_ok($$select public.duplicate_question('a9400000-0000-0000-0000-000000000002', 'a9500000-0000-0000-0000-000000000002')$$,
  'Menjodohkan diduplikat');
select is((select string_agg(left_text || '=' || right_text, '|' order by position) from public.question_pairs
  where question_id = 'a9500000-0000-0000-0000-000000000002'), 'Jakarta=Indonesia|Tokyo=Jepang', 'Pasangan tersalin urut');
select is((select count(*)::int from public.question_pairs a join public.question_pairs b using (right_key)
  where a.question_id = 'a9400000-0000-0000-0000-000000000002' and b.question_id = 'a9500000-0000-0000-0000-000000000002'),
  0, 'right_key salinan baru (tidak sama dengan sumber)');

select lives_ok($$select public.duplicate_question('a9400000-0000-0000-0000-000000000003', 'a9500000-0000-0000-0000-000000000003')$$,
  'Multi essay diduplikat');
select is((select string_agg(content || ':' || points || ':' || created_by, '|' order by position) from public.questions
  where parent_id = 'a9500000-0000-0000-0000-000000000003'),
  'S1:2.00:a9100000-0000-0000-0000-000000000002|S2:1.00:a9100000-0000-0000-0000-000000000002', 'Sub-soal tersalin, milik penyalin');
select is((select points from public.questions where id = 'a9500000-0000-0000-0000-000000000003'), 3.00::numeric, 'Poin induk tersalin');

-- Sub-soal tidak bisa diduplikat sendiri
select throws_ok(format($$select public.duplicate_question('%s', gen_random_uuid())$$,
  (select id from public.questions where parent_id = 'a9400000-0000-0000-0000-000000000003' limit 1)),
  '22023', 'Soal tidak ditemukan', 'Sub-soal ditolak');

-- Admin Sekolah (hanya baca) & guru sekolah lain ditolak --------------------------------
select pg_temp.login_as('a9100000-0000-0000-0000-000000000003');
select throws_ok($$select public.duplicate_question('a9400000-0000-0000-0000-000000000001', gen_random_uuid())$$,
  null, null, 'Admin Sekolah tidak bisa menduplikat');

select pg_temp.login_as('a9100000-0000-0000-0000-000000000004');
select throws_ok($$select public.duplicate_question('a9400000-0000-0000-0000-000000000001', gen_random_uuid())$$,
  '22023', 'Soal tidak ditemukan', 'Guru sekolah lain tidak melihat sumber');
select is((select count(*)::int from public.questions), 0, 'Guru sekolah lain tetap 0 baris');

select * from finish();
rollback;
