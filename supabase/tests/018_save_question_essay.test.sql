-- F2.11 — save_question: Essay & Multi essay
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.tenants (id, code, name, status, active_until) values
  ('a8000000-0000-0000-0000-00000000000a', 'SAVEC', 'Sekolah A', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('a8100000-0000-0000-0000-00000000000' || n)::uuid, 'x' || n || '@test.local'
from generate_series(1, 2) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('a8100000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 1', 'G1'),
  ('a8100000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 2', 'G2');

insert into public.subjects (id, tenant_id, code, name) values
  ('a8300000-0000-0000-0000-000000000001', 'a8000000-0000-0000-0000-00000000000a', 'BIO', 'Biologi'),
  ('a8300000-0000-0000-0000-000000000002', 'a8000000-0000-0000-0000-00000000000a', 'KIM', 'Kimia');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.essay(p_answer_key text, p_keywords text[] default '{}') returns uuid language sql as $$
  select public.save_question('a8400000-0000-0000-0000-000000000001', 'a8300000-0000-0000-0000-000000000001',
    'essay', 'Jelaskan fotosintesis', null, 4, null, p_answer_key => p_answer_key, p_keywords => p_keywords);
$$;

create function pg_temp.multi(p_subs text, p_subject uuid default 'a8300000-0000-0000-0000-000000000001') returns uuid language sql as $$
  select public.save_question('a8400000-0000-0000-0000-000000000002', p_subject,
    'multi_essay', 'Bacalah teks berikut', null, 99, null, p_subs => p_subs::jsonb);
$$;

set local role authenticated;
select pg_temp.login_as('a8100000-0000-0000-0000-000000000001');

-- Essay -------------------------------------------------------------------------------
select lives_ok($$select pg_temp.essay(' Proses tumbuhan membuat makanan ', array[' klorofil', 'cahaya', '', 'Klorofil '])$$,
  'Essay tersimpan');
select is((select answer_key from public.questions where type = 'essay'), 'Proses tumbuhan membuat makanan',
  'Jawaban acuan di-trim');
select is((select keywords from public.questions where type = 'essay'), array['klorofil', 'cahaya'],
  'Kata kunci dirapikan: trim, kosong & kembar dibuang, urutan tetap');
select is((select points from public.questions where type = 'essay'), 4.00::numeric, 'Poin essay dari p_points');

select throws_ok($$select pg_temp.essay('  ')$$, '22023', null, 'Essay tanpa jawaban acuan ditolak');
select throws_ok($$select pg_temp.essay('x', array(select 'k' || n from generate_series(1, 21) n))$$,
  '22023', null, 'Lebih dari 20 kata kunci ditolak');

-- Multi essay -------------------------------------------------------------------------
select lives_ok($$select pg_temp.multi('[
  {"id": null, "content": "Apa itu sel?", "answer_key": "Unit terkecil kehidupan", "keywords": ["unit"], "points": 2},
  {"id": null, "content": "Sebutkan organel", "answer_key": "Mitokondria, ribosom", "keywords": [], "points": 3.5}
]')$$, 'Multi essay tersimpan');
select is((select points from public.questions where type = 'multi_essay'), 5.50::numeric,
  'Poin induk = jumlah poin sub-soal (p_points diabaikan)');
select is((select string_agg(content || ':' || position, '|' order by position) from public.questions
  where parent_id = 'a8400000-0000-0000-0000-000000000002'), 'Apa itu sel?:0|Sebutkan organel:1', '2 sub-soal urut');
select is((select count(*)::int from public.questions where parent_id is not null and type = 'essay'
  and created_by = 'a8100000-0000-0000-0000-000000000001' and subject_id = 'a8300000-0000-0000-0000-000000000001'),
  2, 'Sub-soal bertipe essay, milik guru & mapel induk');
select is((select answer_key from public.questions where type = 'multi_essay'), null, 'Induk tanpa jawaban acuan');

create temp table subs as
  select id, position from public.questions where parent_id = 'a8400000-0000-0000-0000-000000000002';
grant select on subs to authenticated;

-- Ubah: tukar urutan, ubah poin, tambah satu, ganti mapel
select lives_ok(format($$select pg_temp.multi('[
  {"id": "%s", "content": "Sebutkan organel", "answer_key": "Mitokondria", "keywords": [], "points": 1},
  {"id": "%s", "content": "Apa itu sel?", "answer_key": "Unit terkecil kehidupan", "keywords": [], "points": 2},
  {"id": null, "content": "Fungsi mitokondria?", "answer_key": "Respirasi sel", "keywords": [], "points": 1}
]', 'a8300000-0000-0000-0000-000000000002')$$,
  (select id from subs where position = 1), (select id from subs where position = 0)), 'Multi essay diubah');
select is((select points from public.questions where type = 'multi_essay'), 4.00::numeric, 'Total poin ikut berubah');
select is((select id from public.questions where parent_id = 'a8400000-0000-0000-0000-000000000002' and position = 0),
  (select id from subs where position = 1), 'Id sub-soal tetap saat diurutkan ulang');
select is((select count(distinct subject_id)::int from public.questions
  where id = 'a8400000-0000-0000-0000-000000000002' or parent_id = 'a8400000-0000-0000-0000-000000000002'),
  1, 'Ganti mapel: induk & sub-soal ikut');

-- Hapus satu sub-soal
select lives_ok(format($$select pg_temp.multi('[
  {"id": "%s", "content": "Apa itu sel?", "answer_key": "Unit", "keywords": [], "points": 2},
  {"id": null, "content": "Baru", "answer_key": "Baru", "keywords": [], "points": 2}
]', 'a8300000-0000-0000-0000-000000000002')$$, (select id from subs where position = 0)), 'Sub-soal dihapus & ditambah');
select is((select count(*)::int from public.questions where parent_id = 'a8400000-0000-0000-0000-000000000002'),
  2, 'Tinggal 2 sub-soal');

-- Validasi
select throws_ok($$select pg_temp.multi('[{"id": null, "content": "a", "answer_key": "b", "keywords": [], "points": 1}]')$$,
  '22023', null, 'Satu sub-soal ditolak');
select throws_ok($$select pg_temp.multi('[
  {"id": null, "content": "a", "answer_key": "b", "keywords": [], "points": 1},
  {"id": null, "content": "c", "answer_key": " ", "keywords": [], "points": 1}
]')$$, '22023', 'Sub-soal 2: jawaban acuan wajib diisi (maks 10.000 karakter)', 'Sub-soal tanpa jawaban acuan ditolak');
select throws_ok($$select pg_temp.multi('[
  {"id": null, "content": "a", "answer_key": "b", "keywords": [], "points": 1},
  {"id": null, "content": "c", "answer_key": "d", "keywords": [], "points": 0}
]')$$, '22023', null, 'Sub-soal poin 0 ditolak');
-- id milik soal lain (essay mandiri milik guru yang sama) tidak boleh dibajak jadi sub-soal
select throws_ok($$select pg_temp.multi('[
  {"id": "a8400000-0000-0000-0000-000000000001", "content": "a", "answer_key": "b", "keywords": [], "points": 1},
  {"id": null, "content": "c", "answer_key": "d", "keywords": [], "points": 1}
]')$$, '22023', 'Sub-soal tidak valid', 'Id soal lain ditolak');

-- Ganti tipe: multi essay → essay, sub-soal terhapus
select lives_ok($$select public.save_question('a8400000-0000-0000-0000-000000000002', 'a8300000-0000-0000-0000-000000000001',
  'essay', 'Bacalah', null, 2, null, p_answer_key => 'x')$$, 'Multi essay → essay');
select is((select count(*)::int from public.questions where parent_id = 'a8400000-0000-0000-0000-000000000002'),
  0, 'Sub-soal lama terhapus');

-- Guru lain
select pg_temp.login_as('a8100000-0000-0000-0000-000000000002');
select throws_ok($$select pg_temp.essay('x')$$, '42501', null, 'Guru lain tidak bisa menimpa soal');

select * from finish();
rollback;
