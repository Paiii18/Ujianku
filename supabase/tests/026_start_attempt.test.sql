-- F3.7 — start_attempt, get_exam_questions, gambar soal untuk murid
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Sekolah A aktif; sekolah B masa aktif habis 1 jam lalu (uji masa tenggang)
insert into public.tenants (id, code, name, status, active_until) values
  ('af000000-0000-0000-0000-00000000000a', 'SAA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('af000000-0000-0000-0000-00000000000b', 'SAB', 'Sekolah B', 'inactive', now() - interval '1 hour');
insert into auth.users (id, email)
select ('af100000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'sa' || n || '@test.local'
from generate_series(1, 7) n;
-- 01 guru A, 02 S1, 03 S2 (bukan peserta), 04 S3, 05 S4, 06 murid B, 07 guru B
insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('af100000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A', 'G1'),
  ('af100000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-00000000000a', 'student', 'S1', '1'),
  ('af100000-0000-0000-0000-000000000003', 'af000000-0000-0000-0000-00000000000a', 'student', 'S2', '2'),
  ('af100000-0000-0000-0000-000000000004', 'af000000-0000-0000-0000-00000000000a', 'student', 'S3', '3'),
  ('af100000-0000-0000-0000-000000000005', 'af000000-0000-0000-0000-00000000000a', 'student', 'S4', '4'),
  ('af100000-0000-0000-0000-000000000006', 'af000000-0000-0000-0000-00000000000b', 'student', 'SB', '1'),
  ('af100000-0000-0000-0000-000000000007', 'af000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1');
insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('af200000-0000-0000-0000-00000000000a', 'af000000-0000-0000-0000-00000000000a', '2026/2027', 1, true),
  ('af200000-0000-0000-0000-00000000000b', 'af000000-0000-0000-0000-00000000000b', '2026/2027', 1, true);
insert into public.subjects (id, tenant_id, code, name) values
  ('af300000-0000-0000-0000-00000000000a', 'af000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika'),
  ('af300000-0000-0000-0000-00000000000b', 'af000000-0000-0000-0000-00000000000b', 'MTK', 'Matematika');

-- Soal A: 01 PG, 02 BS, 03 isian, 04 jodoh, 05 essay, 06 multi essay (+ sub 61, 62), 07 di luar ujian
insert into public.questions (id, tenant_id, subject_id, created_by, type, content, image_path, points,
  answer_key, accepted_answers, keywords, explanation) values
  ('af400000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'multiple_choice', 'Q1', 'af000000-0000-0000-0000-00000000000a/af400000-0000-0000-0000-000000000001/soal.webp',
   2, null, null, null, 'PEMBAHASANRAHASIA'),
  ('af400000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'true_false', 'Q2', null, 1, null, null, null, null),
  ('af400000-0000-0000-0000-000000000003', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'short_answer', 'Q3', null, 1, null, array['ISIANRAHASIA'], null, null),
  ('af400000-0000-0000-0000-000000000004', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'matching', 'Q4', null, 3, null, null, null, null),
  ('af400000-0000-0000-0000-000000000005', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'essay', 'Q5', null, 4, 'ACUANRAHASIA', null, array['KATARAHASIA'], null),
  ('af400000-0000-0000-0000-000000000006', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'multi_essay', 'Q6', null, 0, null, null, null, null),
  ('af400000-0000-0000-0000-000000000007', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'essay', 'Q7', null, 1, 'x', null, null, null);
insert into public.questions (id, tenant_id, subject_id, created_by, parent_id, position, type, content, points, answer_key) values
  ('af400000-0000-0000-0000-000000000061', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'af400000-0000-0000-0000-000000000006', 1, 'essay', 'Q6a', 2, 'SUBRAHASIA'),
  ('af400000-0000-0000-0000-000000000062', 'af000000-0000-0000-0000-00000000000a', 'af300000-0000-0000-0000-00000000000a',
   'af100000-0000-0000-0000-000000000001', 'af400000-0000-0000-0000-000000000006', 2, 'essay', 'Q6b', 3, 'SUBRAHASIA');
insert into public.question_options (question_id, label, content, is_correct)
select 'af400000-0000-0000-0000-000000000001', l, 'opsi ' || l, l = 'B' from unnest(array['A', 'B', 'C', 'D']) l;
insert into public.question_options (question_id, label, content, is_correct) values
  ('af400000-0000-0000-0000-000000000002', 'A', 'Benar', true),
  ('af400000-0000-0000-0000-000000000002', 'B', 'Salah', false);
insert into public.question_pairs (question_id, position, left_text, right_text)
select 'af400000-0000-0000-0000-000000000004', n, 'kiri' || n, 'kanan' || n from generate_series(1, 3) n;
insert into public.questions (id, tenant_id, subject_id, created_by, type, content) values
  ('af400000-0000-0000-0000-0000000000b1', 'af000000-0000-0000-0000-00000000000b', 'af300000-0000-0000-0000-00000000000b',
   'af100000-0000-0000-0000-000000000007', 'essay', 'QB');

-- Ujian A: 01 berlangsung (acak), 02 besok, 03 sudah lewat, 04 draft, 05 berakhir 20 menit lagi (tanpa acak)
-- Ujian B: b1 dimulai sebelum masa aktif habis (tenggang), b2 dimulai sesudahnya
insert into public.exams (id, tenant_id, academic_year_id, subject_id, created_by, title, start_at, end_at,
  duration_minutes, status, access_token, shuffle_questions, shuffle_options) values
  ('af500000-0000-0000-0000-000000000001', 'af000000-0000-0000-0000-00000000000a', 'af200000-0000-0000-0000-00000000000a',
   'af300000-0000-0000-0000-00000000000a', 'af100000-0000-0000-0000-000000000001', 'E1',
   now() - interval '10 minutes', now() + interval '2 hours', 60, 'published', 'ABCDEF', true, true),
  ('af500000-0000-0000-0000-000000000002', 'af000000-0000-0000-0000-00000000000a', 'af200000-0000-0000-0000-00000000000a',
   'af300000-0000-0000-0000-00000000000a', 'af100000-0000-0000-0000-000000000001', 'E2',
   now() + interval '1 day', now() + interval '1 day 2 hours', 60, 'published', 'BCDEFG', true, true),
  ('af500000-0000-0000-0000-000000000003', 'af000000-0000-0000-0000-00000000000a', 'af200000-0000-0000-0000-00000000000a',
   'af300000-0000-0000-0000-00000000000a', 'af100000-0000-0000-0000-000000000001', 'E3',
   now() - interval '3 hours', now() - interval '1 hour', 60, 'published', 'CDEFGH', true, true),
  ('af500000-0000-0000-0000-000000000004', 'af000000-0000-0000-0000-00000000000a', 'af200000-0000-0000-0000-00000000000a',
   'af300000-0000-0000-0000-00000000000a', 'af100000-0000-0000-0000-000000000001', 'E4',
   now() - interval '10 minutes', now() + interval '2 hours', 60, 'draft', null, true, true),
  ('af500000-0000-0000-0000-000000000005', 'af000000-0000-0000-0000-00000000000a', 'af200000-0000-0000-0000-00000000000a',
   'af300000-0000-0000-0000-00000000000a', 'af100000-0000-0000-0000-000000000001', 'E5',
   now() - interval '10 minutes', now() + interval '20 minutes', 60, 'published', 'DEFGHJ', false, false),
  ('af500000-0000-0000-0000-0000000000b1', 'af000000-0000-0000-0000-00000000000b', 'af200000-0000-0000-0000-00000000000b',
   'af300000-0000-0000-0000-00000000000b', 'af100000-0000-0000-0000-000000000007', 'EB1',
   now() - interval '2 hours', now() + interval '1 hour', 60, 'published', 'EFGHJK', true, true),
  ('af500000-0000-0000-0000-0000000000b2', 'af000000-0000-0000-0000-00000000000b', 'af200000-0000-0000-0000-00000000000b',
   'af300000-0000-0000-0000-00000000000b', 'af100000-0000-0000-0000-000000000007', 'EB2',
   now() - interval '30 minutes', now() + interval '1 hour', 60, 'published', 'FGHJKL', true, true);

insert into public.exam_questions (tenant_id, exam_id, question_id, order_no, points)
select 'af000000-0000-0000-0000-00000000000a', e, ('af400000-0000-0000-0000-00000000000' || n)::uuid, n,
  case when n = 1 then 5 end -- poin override soal 1
from unnest(array['af500000-0000-0000-0000-000000000001', 'af500000-0000-0000-0000-000000000005']::uuid[]) e,
  generate_series(1, 6) n;
insert into public.exam_questions (tenant_id, exam_id, question_id, order_no) values
  ('af000000-0000-0000-0000-00000000000b', 'af500000-0000-0000-0000-0000000000b1', 'af400000-0000-0000-0000-0000000000b1', 1);

insert into public.exam_participants (tenant_id, exam_id, student_id)
select 'af000000-0000-0000-0000-00000000000a', e, s
from unnest(array['af500000-0000-0000-0000-000000000001', 'af500000-0000-0000-0000-000000000002',
  'af500000-0000-0000-0000-000000000003', 'af500000-0000-0000-0000-000000000004',
  'af500000-0000-0000-0000-000000000005']::uuid[]) e,
  unnest(array['af100000-0000-0000-0000-000000000002', 'af100000-0000-0000-0000-000000000004',
  'af100000-0000-0000-0000-000000000005']::uuid[]) s;
insert into public.exam_participants (tenant_id, exam_id, student_id) values
  ('af000000-0000-0000-0000-00000000000b', 'af500000-0000-0000-0000-0000000000b1', 'af100000-0000-0000-0000-000000000006'),
  ('af000000-0000-0000-0000-00000000000b', 'af500000-0000-0000-0000-0000000000b2', 'af100000-0000-0000-0000-000000000006');

-- S3: attempt E1 yang batas waktunya sudah lewat; S4: attempt E1 yang dibatalkan (ujian ulang)
insert into public.exam_attempts (tenant_id, exam_id, student_id, attempt_no, deadline_at, is_voided) values
  ('af000000-0000-0000-0000-00000000000a', 'af500000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000004', 1, now() - interval '1 minute', false),
  ('af000000-0000-0000-0000-00000000000a', 'af500000-0000-0000-0000-000000000001', 'af100000-0000-0000-0000-000000000005', 1, now() + interval '1 hour', true);

-- Objek gambar (baris storage.objects langsung; isi file tidak perlu)
insert into storage.objects (bucket_id, name) values
  ('question-images', 'af000000-0000-0000-0000-00000000000a/af400000-0000-0000-0000-000000000001/soal.webp'),
  ('question-images', 'af000000-0000-0000-0000-00000000000a/af400000-0000-0000-0000-000000000007/soal.webp');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create temp table res (n int, attempt_id uuid, deadline_at timestamptz, session_id uuid);
create temp table qs (j jsonb);
grant all on res, qs to authenticated;

set local role authenticated;

-- start_attempt: penolakan ----------------------------------------------------------
select pg_temp.login_as('af100000-0000-0000-0000-000000000003');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000001', 'ABCDEF')$$,
  '22023', 'Ujian tidak ditemukan', 'bukan peserta ditolak');

select pg_temp.login_as('af100000-0000-0000-0000-000000000002');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000004', 'ABCDEF')$$,
  '22023', 'Ujian tidak ditemukan', 'ujian draft ditolak');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000002', 'BCDEFG')$$,
  '22023', 'Ujian belum dimulai', 'sebelum jadwal ditolak');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000003', 'CDEFGH')$$,
  '22023', 'Ujian sudah berakhir', 'setelah jadwal ditolak');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000001', 'BCDEFG')$$,
  '22023', 'Token salah', 'token ujian lain ditolak');

-- start_attempt: mulai & lanjutkan --------------------------------------------------
insert into res select 1, * from public.start_attempt('af500000-0000-0000-0000-000000000001', ' abc def ');
select is((select deadline_at from res where n = 1), now() + interval '60 minutes',
  'token huruf kecil + spasi diterima; deadline = mulai + durasi');
insert into res select 2, * from public.start_attempt('af500000-0000-0000-0000-000000000001', 'ABCDEF');
select ok((select r2.attempt_id = r1.attempt_id and r2.session_id <> r1.session_id and r2.deadline_at = r1.deadline_at
  from res r1, res r2 where r1.n = 1 and r2.n = 2), 'mulai lagi = attempt sama, deadline sama, sesi diputar');
insert into res select 3, * from public.start_attempt('af500000-0000-0000-0000-000000000005', 'DEFGHJ');
select is((select deadline_at from res where n = 3), now() + interval '20 minutes', 'deadline dipotong end_at');

select pg_temp.login_as('af100000-0000-0000-0000-000000000004');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000001', 'ABCDEF')$$,
  '22023', 'Waktu ujian sudah habis', 'attempt yang lewat batas waktu tidak bisa dilanjutkan');

select pg_temp.login_as('af100000-0000-0000-0000-000000000005');
insert into res select 4, * from public.start_attempt('af500000-0000-0000-0000-000000000001', 'ABCDEF');
reset role;
select is((select attempt_no::int from public.exam_attempts a join res on res.attempt_id = a.id where n = 4), 2,
  'attempt lama dibatalkan → attempt ke-2');
set local role authenticated;

select pg_temp.login_as('af100000-0000-0000-0000-000000000001');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000001', 'ABCDEF')$$,
  '22023', 'Ujian tidak ditemukan', 'guru tidak bisa memulai attempt');

-- Masa tenggang ---------------------------------------------------------------------
select pg_temp.login_as('af100000-0000-0000-0000-000000000006');
select lives_ok($$select public.start_attempt('af500000-0000-0000-0000-0000000000b1', 'EFGHJK')$$,
  'sekolah habis: ujian yang dimulai sebelum masa aktif habis tetap bisa dikerjakan');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-0000000000b2', 'FGHJKL')$$,
  '22023', 'Ujian tidak ditemukan', 'sekolah habis: ujian yang dimulai sesudahnya ditolak');

-- get_exam_questions ----------------------------------------------------------------
reset role;
create temp table expected_order as
select array_agg(eq.question_id order by md5(r.attempt_id::text || eq.question_id::text)) ids
from public.exam_questions eq, res r where r.n = 1 and eq.exam_id = 'af500000-0000-0000-0000-000000000001';
grant select on expected_order to authenticated;
set local role authenticated;
select pg_temp.login_as('af100000-0000-0000-0000-000000000002');
insert into qs select public.get_exam_questions((select attempt_id from res where n = 1));

select is((select jsonb_array_length(j -> 'questions') from qs), 6, '6 soal induk');
select ok((select j::text !~* 'is_correct|answer_key|accepted_answers|keywords|explanation|RAHASIA|right_text' from qs),
  'tanpa kunci, jawaban diterima, acuan, kata kunci, pembahasan');
select is(
  (select array_agg((x ->> 'id')::uuid order by i) from qs, jsonb_array_elements(j -> 'questions') with ordinality t(x, i)),
  (select ids from expected_order),
  'urutan soal diacak per attempt (md5) — sama setiap dipanggil');
select is(public.get_exam_questions((select attempt_id from res where n = 1)), (select j from qs),
  'panggilan ulang (refresh) = hasil identik');
select is((select (x ->> 'points')::numeric from qs, jsonb_array_elements(j -> 'questions') x where x ->> 'content' = 'Q1'),
  5::numeric, 'poin override ujian dipakai');
select is((select array_agg(o ->> 'content' order by i) from qs, jsonb_array_elements(j -> 'questions') x,
    jsonb_array_elements(x -> 'options') with ordinality t(o, i) where x ->> 'content' = 'Q2'),
  array['Benar', 'Salah'], 'Benar/Salah tidak diacak');
select ok((select (select array_agg(k) from jsonb_array_elements(x -> 'rights') r, jsonb_object_keys(r) k) <@ array['key', 'text']
    and (select array_agg(k) from jsonb_array_elements(x -> 'lefts') l, jsonb_object_keys(l) k) <@ array['id', 'text']
    and jsonb_array_length(x -> 'rights') = 3
  from qs, jsonb_array_elements(j -> 'questions') x where x ->> 'content' = 'Q4'),
  'menjodohkan: kiri & kanan terpisah, tanpa pasangan');
select is((select array_agg(s ->> 'content' order by i) from qs, jsonb_array_elements(j -> 'questions') x,
    jsonb_array_elements(x -> 'subs') with ordinality t(s, i) where x ->> 'content' = 'Q6'),
  array['Q6a', 'Q6b'], 'multi essay: sub-soal urut');

select pg_temp.login_as('af100000-0000-0000-0000-000000000004');
select throws_ok(format('select public.get_exam_questions(%L)', (select attempt_id from res where n = 1)),
  '22023', 'Ujian tidak ditemukan', 'attempt murid lain ditolak');

-- Jawaban tersimpan ikut kembali (lanjutkan sesi)
reset role;
insert into public.attempt_answers (tenant_id, attempt_id, question_id, selected_option_id)
select 'af000000-0000-0000-0000-00000000000a', r.attempt_id, o.question_id, o.id
from res r, public.question_options o
where r.n = 1 and o.question_id = 'af400000-0000-0000-0000-000000000001' and o.label = 'C';
create temp table opt_c as
select id from public.question_options where question_id = 'af400000-0000-0000-0000-000000000001' and label = 'C';
grant select on opt_c to authenticated;
set local role authenticated;
select pg_temp.login_as('af100000-0000-0000-0000-000000000002');
select is(
  (select (x -> 'answer' ->> 'selected_option_id')::uuid
   from jsonb_array_elements(public.get_exam_questions((select attempt_id from res where n = 1)) -> 'questions') x
   where x ->> 'content' = 'Q1'),
  (select id from opt_c), 'jawaban tersimpan ikut kembali (lanjutkan sesi)');

-- Gambar ----------------------------------------------------------------------------
select is((select array_agg(name) from storage.objects where bucket_id = 'question-images' and name like 'af%'),
  array['af000000-0000-0000-0000-00000000000a/af400000-0000-0000-0000-000000000001/soal.webp'],
  'murid melihat gambar soal di ujian yang sedang dikerjakan saja');
select pg_temp.login_as('af100000-0000-0000-0000-000000000003');
select is((select count(*)::int from storage.objects where bucket_id = 'question-images' and name like 'af%'), 0,
  'murid tanpa attempt: 0 gambar');

-- Dikumpulkan -----------------------------------------------------------------------
reset role;
update public.exam_attempts set status = 'submitted', submitted_at = now()
where id = (select attempt_id from res where n = 1);
set local role authenticated;
select pg_temp.login_as('af100000-0000-0000-0000-000000000002');
select throws_ok($$select public.start_attempt('af500000-0000-0000-0000-000000000001', 'ABCDEF')$$,
  '22023', 'Ujian sudah dikumpulkan', 'sudah dikumpulkan: tidak bisa mulai lagi');
select throws_ok(format('select public.get_exam_questions(%L)', (select attempt_id from res where n = 1)),
  '22023', 'Ujian sudah dikumpulkan', 'sudah dikumpulkan: soal tidak bisa diambil');

select * from finish();
rollback;
