-- F2.9 — save_question (PG & BS)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into public.tenants (id, code, name, status, active_until) values
  ('90000000-0000-0000-0000-00000000000a', 'SAVEA', 'Sekolah A', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('91000000-0000-0000-0000-00000000000' || n)::uuid, 'v' || n || '@test.local'
from generate_series(1, 4) n;

insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 1', 'G1'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 2', 'G2'),
  ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin', null),
  ('91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-00000000000a', 'student', 'Murid', '1');

insert into public.subjects (id, tenant_id, code, name) values
  ('93000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika');

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Panggil save_question untuk soal Q1 dengan tipe & opsi tertentu
create function pg_temp.save(p_type text, p_options text, p_image text default null) returns uuid language sql as $$
  select public.save_question('94000000-0000-0000-0000-000000000001', '93000000-0000-0000-0000-000000000001',
    p_type::public.question_type, ' 12 × 8 = ... ', p_image, 2, '', p_options::jsonb);
$$;

set local role authenticated;
select pg_temp.login_as('91000000-0000-0000-0000-000000000001');

-- Buat ------------------------------------------------------------------------------
select is(pg_temp.save('multiple_choice', '[
  {"label": "A", "content": "96", "is_correct": true},
  {"label": "B", "content": "86", "is_correct": false},
  {"label": "C", "content": "106", "is_correct": false},
  {"label": "D", "content": "", "image_path": "90000000-0000-0000-0000-00000000000a/94000000-0000-0000-0000-000000000001/d.webp", "is_correct": false}
]'), '94000000-0000-0000-0000-000000000001'::uuid, 'Soal PG tersimpan');
select is((select content || '|' || points || '|' || coalesce(explanation, 'null') from public.questions),
  '12 × 8 = ...|2.00|null', 'Teks di-trim, pembahasan kosong = null');
select is((select count(*)::int from public.question_options), 4, '4 opsi tersimpan');

create temp table opt_a as select id from public.question_options where label = 'A';

select lives_ok($$select pg_temp.save('multiple_choice', '[{"label": "A", "content": "1", "is_correct": true}, {"label": "B", "content": "2", "is_correct": false}]', '')$$,
  'Gambar soal kosong ("") = tanpa gambar');

-- Ubah: 3 opsi, kunci pindah ke B -----------------------------------------------------
select lives_ok($$select pg_temp.save('multiple_choice', '[
  {"label": "A", "content": "96 (ubah)", "is_correct": false},
  {"label": "B", "content": "86", "is_correct": true},
  {"label": "C", "content": "106", "is_correct": false}
]')$$, 'Soal PG diubah');
select is((select string_agg(label, '' order by label) from public.question_options), 'ABC', 'Opsi D terhapus');
select is((select label from public.question_options where is_correct), 'B', 'Kunci pindah ke B');
select is((select id from public.question_options where label = 'A'), (select id from opt_a),
  'Id opsi A tetap (upsert per label)');

-- Validasi ---------------------------------------------------------------------------
select throws_ok($$select pg_temp.save('multiple_choice', '[{"label": "A", "content": "1", "is_correct": false}, {"label": "B", "content": "2", "is_correct": false}]')$$,
  '22023', 'Harus ada tepat satu kunci jawaban', 'Tanpa kunci ditolak');
select throws_ok($$select pg_temp.save('multiple_choice', '[{"label": "A", "content": "1", "is_correct": true}, {"label": "B", "content": "2", "is_correct": true}]')$$,
  '22023', 'Harus ada tepat satu kunci jawaban', 'Dua kunci ditolak');
select throws_ok($$select pg_temp.save('multiple_choice', '[{"label": "A", "content": "1", "is_correct": true}]')$$,
  '22023', null, 'Satu opsi ditolak');
select throws_ok($$select pg_temp.save('multiple_choice', '[{"label": "A", "content": "1", "is_correct": true}, {"label": "C", "content": "2", "is_correct": false}]')$$,
  '22023', null, 'Label loncat (A, C) ditolak');
select throws_ok($$select pg_temp.save('multiple_choice', '[{"label": "A", "content": "1", "is_correct": true}, {"label": "B", "content": " ", "is_correct": false}]')$$,
  '22023', 'Setiap opsi harus berisi teks atau gambar', 'Opsi kosong ditolak');
select throws_ok($$select pg_temp.save('true_false', '[{"label": "A", "content": "Benar", "is_correct": true}, {"label": "B", "content": "Salah", "is_correct": false}, {"label": "C", "content": "?", "is_correct": false}]')$$,
  '22023', null, 'Benar/Salah dengan 3 opsi ditolak');
select throws_ok($$select pg_temp.save('multiple_choice', '[{"label": "A", "content": "1", "is_correct": true}, {"label": "B", "content": "2", "is_correct": false}]',
  'ffffffff-0000-0000-0000-00000000000b/94000000-0000-0000-0000-000000000001/x.png')$$,
  '22023', 'Path gambar tidak valid', 'Gambar dari folder lain ditolak');
select throws_ok($$select pg_temp.save('essay', '[]')$$, '22023', null, 'Tipe lain belum didukung');

-- Ubah ke Benar/Salah: opsi C ikut terhapus ---------------------------------------------
select lives_ok($$select pg_temp.save('true_false', '[{"label": "A", "content": "Benar", "is_correct": false}, {"label": "B", "content": "Salah", "is_correct": true}]')$$,
  'Soal Benar/Salah tersimpan');
select is((select string_agg(label, '' order by label) from public.question_options), 'AB', 'Hanya opsi A & B');

-- Peran lain -------------------------------------------------------------------------
select pg_temp.login_as('91000000-0000-0000-0000-000000000002');
select throws_ok($$select pg_temp.save('true_false', '[{"label": "A", "content": "Benar", "is_correct": true}, {"label": "B", "content": "Salah", "is_correct": false}]')$$,
  '42501', null, 'Guru lain tidak bisa menimpa soal');

select pg_temp.login_as('91000000-0000-0000-0000-000000000004');
select throws_ok($$select public.save_question(gen_random_uuid(), '93000000-0000-0000-0000-000000000001', 'true_false', 'X', null, 1, null,
  '[{"label": "A", "content": "Benar", "is_correct": true}, {"label": "B", "content": "Salah", "is_correct": false}]')$$,
  null, null, 'Murid tidak bisa membuat soal');

select * from finish();
rollback;
