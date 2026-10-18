-- F2.10 — save_question: Isian & Menjodohkan
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into public.tenants (id, code, name, status, active_until) values
  ('a7000000-0000-0000-0000-00000000000a', 'SAVEB', 'Sekolah A', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('a7100000-0000-0000-0000-00000000000' || n)::uuid, 'w' || n || '@test.local'
from generate_series(1, 2) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('a7100000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 1', 'G1'),
  ('a7100000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 2', 'G2');

insert into public.subjects (id, tenant_id, code, name) values
  ('a7300000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-00000000000a', 'IPS', 'IPS');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.isian(p_answers text[]) returns uuid language sql as $$
  select public.save_question('a7400000-0000-0000-0000-000000000001', 'a7300000-0000-0000-0000-000000000001',
    'short_answer', 'Ibu kota Indonesia?', null, 1, null, p_answers => p_answers);
$$;

create function pg_temp.jodoh(p_pairs text) returns uuid language sql as $$
  select public.save_question('a7400000-0000-0000-0000-000000000002', 'a7300000-0000-0000-0000-000000000001',
    'matching', 'Pasangkan ibu kota', null, 3, null, p_pairs => p_pairs::jsonb);
$$;

set local role authenticated;
select pg_temp.login_as('a7100000-0000-0000-0000-000000000001');

-- Isian -------------------------------------------------------------------------------
select lives_ok($$select pg_temp.isian(array[' Jakarta ', 'DKI Jakarta'])$$, 'Isian tersimpan');
select is((select accepted_answers from public.questions where type = 'short_answer'),
  array['Jakarta', 'DKI Jakarta'], 'Jawaban di-trim, urutan tetap');
select is((select count(*)::int from public.question_options), 0, 'Isian tanpa opsi');

select throws_ok($$select pg_temp.isian('{}')$$, '22023', null, 'Isian tanpa jawaban ditolak');
select throws_ok($$select pg_temp.isian(array['Jakarta', '  '])$$, '22023', null, 'Jawaban kosong ditolak');
select throws_ok($$select pg_temp.isian(array['Jakarta', ' jakarta'])$$,
  '22023', 'Ada jawaban diterima yang sama', 'Jawaban kembar (beda huruf besar/spasi) ditolak');
select throws_ok($$select pg_temp.isian(array['a','b','c','d','e','f','g','h','i','j','k'])$$,
  '22023', null, 'Lebih dari 10 jawaban ditolak');

-- Menjodohkan -------------------------------------------------------------------------
select lives_ok($$select pg_temp.jodoh('[
  {"left": "Jakarta", "right": "Indonesia"},
  {"left": "Tokyo", "right": "Jepang"},
  {"left": " Bangkok ", "right": "Thailand"}
]')$$, 'Menjodohkan tersimpan');
select is((select string_agg(left_text || '=' || right_text, '|' order by position) from public.question_pairs),
  'Jakarta=Indonesia|Tokyo=Jepang|Bangkok=Thailand', '3 pasangan urut, teks di-trim');
select is((select accepted_answers from public.questions where type = 'matching'), null::text[],
  'Menjodohkan tanpa accepted_answers');

create temp table pair0 as select id, right_key from public.question_pairs where position = 0;
grant select on pair0 to authenticated;

select lives_ok($$select pg_temp.jodoh('[
  {"left": "Jakarta", "right": "Republik Indonesia"},
  {"left": "Tokyo", "right": "Jepang"}
]')$$, 'Menjodohkan diubah');
select is((select count(*)::int from public.question_pairs), 2, 'Pasangan ke-3 terhapus');
select is((select right_text from public.question_pairs where position = 0), 'Republik Indonesia', 'Pasangan diubah');
select ok(exists (select 1 from public.question_pairs q join pair0 using (id, right_key) where q.position = 0),
  'Id & right_key pasangan tetap');

select throws_ok($$select pg_temp.jodoh('[{"left": "Jakarta", "right": "Indonesia"}]')$$,
  '22023', null, 'Satu pasangan ditolak');
select throws_ok($$select pg_temp.jodoh('[{"left": "Jakarta", "right": "Indonesia"}, {"left": "Tokyo", "right": " "}]')$$,
  '22023', null, 'Sisi kanan kosong ditolak');
select throws_ok($$select pg_temp.jodoh('[{"left": "Jakarta", "right": "Indonesia"}, {"left": "Bandung", "right": "indonesia"}]')$$,
  '22023', 'Teks di sisi kiri maupun kanan tidak boleh sama', 'Sisi kanan kembar ditolak');

-- Ganti tipe: data tipe lama dibersihkan ------------------------------------------------
select lives_ok($$select public.save_question('a7400000-0000-0000-0000-000000000002', 'a7300000-0000-0000-0000-000000000001',
  'short_answer', 'Ibu kota Jepang?', null, 1, null, p_answers => array['Tokyo'],
  p_pairs => '[{"left": "x", "right": "y"}, {"left": "z", "right": "w"}]')$$, 'Menjodohkan → isian');
select is((select count(*)::int from public.question_pairs), 0, 'Pasangan lama terhapus, p_pairs diabaikan');
select is((select count(*)::int from public.question_options), 0, 'Isian tetap tanpa opsi');

-- Guru lain ---------------------------------------------------------------------------
select pg_temp.login_as('a7100000-0000-0000-0000-000000000002');
select throws_ok($$select pg_temp.jodoh('[{"left": "a", "right": "b"}, {"left": "c", "right": "d"}]')$$,
  '42501', null, 'Guru lain tidak bisa menimpa soal');

select * from finish();
rollback;
