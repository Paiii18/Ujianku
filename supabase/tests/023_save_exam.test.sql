-- F3.3 — save_exam: simpan draft / terbitkan ujian
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- Data (sebagai postgres) ----------------------------------------------------------------

insert into public.tenants (id, code, name, status, active_until) values
  ('ac000000-0000-0000-0000-00000000000a', 'SEA', 'Sekolah A', 'active', now() + interval '30 days');

insert into auth.users (id, email)
select ('ac100000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'se' || n || '@test.local'
from generate_series(1, 6) n;

-- 01 guru, 02 guru lain, 03 admin, 04 murid K1, 05 murid K2 (tambahan), 06 murid nonaktif
insert into public.profiles (id, tenant_id, role, full_name, nis_nip, is_active) values
  ('ac100000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-00000000000a', 'teacher', 'Guru', 'G1', true),
  ('ac100000-0000-0000-0000-000000000002', 'ac000000-0000-0000-0000-00000000000a', 'teacher', 'Guru 2', 'G2', true),
  ('ac100000-0000-0000-0000-000000000003', 'ac000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin', null, true),
  ('ac100000-0000-0000-0000-000000000004', 'ac000000-0000-0000-0000-00000000000a', 'student', 'Murid 1', '001', true),
  ('ac100000-0000-0000-0000-000000000005', 'ac000000-0000-0000-0000-00000000000a', 'student', 'Murid 2', '002', true),
  ('ac100000-0000-0000-0000-000000000006', 'ac000000-0000-0000-0000-00000000000a', 'student', 'Murid 3', '003', false);

insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('ac200000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-00000000000a', '2026/2027', 1, true);
insert into public.subjects (id, tenant_id, code, name) values
  ('ac300000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika'),
  ('ac300000-0000-0000-0000-000000000002', 'ac000000-0000-0000-0000-00000000000a', 'BIO', 'Biologi');
insert into public.classes (id, tenant_id, academic_year_id, name, grade_level) values
  ('ac400000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-00000000000a', 'ac200000-0000-0000-0000-000000000001', 'X 1', 10),
  ('ac400000-0000-0000-0000-000000000002', 'ac000000-0000-0000-0000-00000000000a', 'ac200000-0000-0000-0000-000000000001', 'X 2', 10);
-- Guru: MTK di K1 saja
insert into public.teaching_assignments (tenant_id, teacher_id, subject_id, class_id) values
  ('ac000000-0000-0000-0000-00000000000a', 'ac100000-0000-0000-0000-000000000001', 'ac300000-0000-0000-0000-000000000001', 'ac400000-0000-0000-0000-000000000001');
insert into public.class_students (class_id, student_id, tenant_id, academic_year_id) values
  ('ac400000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000004', 'ac000000-0000-0000-0000-00000000000a', 'ac200000-0000-0000-0000-000000000001'),
  ('ac400000-0000-0000-0000-000000000002', 'ac100000-0000-0000-0000-000000000005', 'ac000000-0000-0000-0000-00000000000a', 'ac200000-0000-0000-0000-000000000001');
-- Soal bank: Q1, Q2 (milik guru lain pun boleh dipakai)
insert into public.questions (id, tenant_id, subject_id, created_by, type, content, points) values
  ('ac500000-0000-0000-0000-000000000001', 'ac000000-0000-0000-0000-00000000000a', 'ac300000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000002', 'essay', 'Q1', 2),
  ('ac500000-0000-0000-0000-000000000002', 'ac000000-0000-0000-0000-00000000000a', 'ac300000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000001', 'essay', 'Q2', 3);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Panggil save_exam dengan nilai default yang valid; argumen yang diuji bisa diganti
create function pg_temp.save(
  p_classes uuid[] default '{ac400000-0000-0000-0000-000000000001}',
  p_students uuid[] default '{ac100000-0000-0000-0000-000000000005}',
  p_questions jsonb default '[{"question_id":"ac500000-0000-0000-0000-000000000002","points":null},{"question_id":"ac500000-0000-0000-0000-000000000001","points":5}]',
  p_publish boolean default false,
  p_subject uuid default 'ac300000-0000-0000-0000-000000000001',
  p_start timestamptz default now() + interval '1 day',
  p_end timestamptz default now() + interval '1 day 2 hours',
  p_duration integer default 90,
  p_id uuid default 'ac600000-0000-0000-0000-000000000001'
) returns uuid language sql as $$
  select public.save_exam(p_id, p_subject, ' UTS ', p_start, p_end, p_duration, 75, p_classes, p_students,
    p_questions, true, true, true, 0.8, 'score', p_publish, 3);
$$;

set local role authenticated;
select pg_temp.login_as('ac100000-0000-0000-0000-000000000001');

-- Validasi ----------------------------------------------------------------------------------
select throws_ok($$select pg_temp.save(p_end => now() + interval '1 day')$$, '22023',
  'Waktu selesai harus setelah waktu mulai', 'selesai sebelum mulai ditolak');
select throws_ok($$select pg_temp.save(p_duration => 180)$$, '22023',
  'Durasi lebih panjang dari rentang jadwal ujian', 'durasi > rentang jadwal ditolak');
select throws_ok($$select pg_temp.save(p_subject => 'ac300000-0000-0000-0000-000000000002')$$, '22023',
  'Anda tidak mengampu mapel ini', 'mapel yang tidak diampu ditolak');
select throws_ok($$select pg_temp.save(p_classes => '{ac400000-0000-0000-0000-000000000002}')$$, '22023',
  'Ada kelas yang tidak Anda ampu untuk mapel ini', 'kelas yang tidak diampu ditolak');
select throws_ok($$select pg_temp.save(p_students => '{ac100000-0000-0000-0000-000000000006}')$$, '22023',
  'Ada murid tambahan yang tidak ditemukan atau nonaktif', 'murid nonaktif ditolak');
select throws_ok($$select pg_temp.save(p_questions => '[{"question_id":"ac500000-0000-0000-0000-000000000001"},{"question_id":"ac500000-0000-0000-0000-000000000001"}]')$$,
  '22023', 'Ada soal yang dipilih lebih dari sekali', 'soal ganda ditolak');
select throws_ok($$select pg_temp.save(p_questions => '[{"question_id":"ac500000-0000-0000-0000-000000000001","points":0}]')$$,
  '22023', 'Poin soal harus 0,01–1000', 'poin 0 ditolak');
select throws_ok($$select pg_temp.save(p_questions => '[]', p_publish => true)$$, '22023',
  'Ujian tanpa soal tidak bisa diterbitkan', 'ujian tanpa soal tidak bisa diterbitkan');
select throws_ok($$select pg_temp.save(p_classes => '{}', p_students => '{}', p_publish => true)$$, '22023',
  'Ujian belum punya peserta: pilih kelas atau murid', 'ujian tanpa peserta tidak bisa diterbitkan');
select is((select count(*)::int from public.exams), 0, 'percobaan gagal tidak meninggalkan ujian');

-- Simpan draft -------------------------------------------------------------------------------
select lives_ok($$select pg_temp.save(p_classes => '{}', p_students => '{}', p_questions => '[]')$$,
  'draft kosong (tanpa kelas & soal) boleh disimpan');
select pg_temp.save();
select results_eq($$select title, status::text, access_token from public.exams$$,
  $$values ('UTS', 'draft', null::char(6))$$, 'draft tersimpan, judul di-trim, belum ada token');
select results_eq($$select student_id from public.exam_participants order by student_id$$,
  $$values ('ac100000-0000-0000-0000-000000000004'::uuid), ('ac100000-0000-0000-0000-000000000005'::uuid)$$,
  'peserta = murid K1 + murid tambahan');
select results_eq($$select question_id, order_no::int, points from public.exam_questions order by order_no$$,
  $$values ('ac500000-0000-0000-0000-000000000002'::uuid, 1, null::numeric), ('ac500000-0000-0000-0000-000000000001'::uuid, 2, 5.00)$$,
  'urutan & poin override tersimpan');

-- Ubah: murid tambahan dihapus, urutan dibalik
select pg_temp.save(p_students => '{}',
  p_questions => '[{"question_id":"ac500000-0000-0000-0000-000000000001"},{"question_id":"ac500000-0000-0000-0000-000000000002"}]');
select results_eq($$select student_id from public.exam_participants$$,
  $$values ('ac100000-0000-0000-0000-000000000004'::uuid)$$, 'murid tambahan dihapus, murid kelas tetap');
select results_eq($$select question_id from public.exam_questions order by order_no$$,
  $$values ('ac500000-0000-0000-0000-000000000001'::uuid), ('ac500000-0000-0000-0000-000000000002'::uuid)$$,
  'urutan soal diperbarui');

-- Terbitkan ---------------------------------------------------------------------------------
select pg_temp.save(p_publish => true);
select ok((select status = 'published' and access_token ~ '^[A-HJ-NP-Z2-9]{6}$' and published_at is not null from public.exams),
  'terbit: status published + token valid');
reset role;
select is((select count(*)::int from public.notifications where type = 'exam_published' and tenant_id = 'ac000000-0000-0000-0000-00000000000a'), 2,
  'notifikasi terkirim ke 2 peserta');
select ok((select bool_and(title = 'Ujian baru: UTS' and body like 'Matematika · %WIB') from public.notifications where tenant_id = 'ac000000-0000-0000-0000-00000000000a'),
  'isi notifikasi: judul & mapel');
set local role authenticated;
select pg_temp.login_as('ac100000-0000-0000-0000-000000000001');

create temp table token_before as select access_token from public.exams;
select pg_temp.save(p_publish => false);
select pg_temp.save(p_publish => true);
select is((select access_token from public.exams), (select access_token from token_before),
  'terbit ulang memakai token yang sama');
reset role;
select is((select count(*)::int from public.notifications where tenant_id = 'ac000000-0000-0000-0000-00000000000a'), 2, 'terbit ulang tidak mengirim notifikasi dobel');

-- Murid melihat notifikasinya sendiri
set local role authenticated;
select pg_temp.login_as('ac100000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.notifications), 1, 'murid melihat notifikasinya sendiri saja');

-- Akses ---------------------------------------------------------------------------------------
select pg_temp.login_as('ac100000-0000-0000-0000-000000000003');
select throws_ok($$select pg_temp.save()$$, '42501', 'Akses ditolak', 'Admin Sekolah tidak bisa membuat ujian');

select pg_temp.login_as('ac100000-0000-0000-0000-000000000002');
select throws_ok($$select pg_temp.save()$$, null, null, 'guru lain tidak bisa mengubah ujian ini');

-- Ujian yang sudah dikerjakan tidak bisa diubah
reset role;
insert into public.exam_attempts (tenant_id, exam_id, student_id, deadline_at) values
  ('ac000000-0000-0000-0000-00000000000a', 'ac600000-0000-0000-0000-000000000001', 'ac100000-0000-0000-0000-000000000004', now() + interval '1 hour');
set local role authenticated;
select pg_temp.login_as('ac100000-0000-0000-0000-000000000001');
select throws_ok($$select pg_temp.save()$$, '22023', 'Ujian sudah dikerjakan murid, tidak bisa diubah',
  'ujian ber-attempt tidak bisa diubah');

select * from finish();
rollback;
