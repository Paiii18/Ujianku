-- F3.1 — Tabel ujian + RLS
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Data (sebagai postgres, tanpa RLS) -----------------------------------------------------

insert into public.tenants (id, code, name, status, active_until) values
  ('aa000000-0000-0000-0000-00000000000a', 'EXA', 'Sekolah A', 'active', now() + interval '30 days'),
  ('aa000000-0000-0000-0000-00000000000b', 'EXB', 'Sekolah B', 'active', now() + interval '30 days'),
  ('aa000000-0000-0000-0000-00000000000c', 'EXC', 'Sekolah C', 'inactive', now() - interval '1 day');

insert into auth.users (id, email)
select ('aa100000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid, 'ex' || n || '@test.local'
from generate_series(1, 9) n;

-- 01 guru A1, 02 guru A2, 03 admin A, 04 murid A1, 05 murid A2, 06 guru B, 07 murid B, 08 guru C, 09 super admin
insert into public.profiles (id, tenant_id, role, full_name, nis_nip) values
  ('aa100000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A1', 'G1'),
  ('aa100000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-00000000000a', 'teacher', 'Guru A2', 'G2'),
  ('aa100000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-00000000000a', 'school_admin', 'Admin A', null),
  ('aa100000-0000-0000-0000-000000000004', 'aa000000-0000-0000-0000-00000000000a', 'student', 'Murid A1', '001'),
  ('aa100000-0000-0000-0000-000000000005', 'aa000000-0000-0000-0000-00000000000a', 'student', 'Murid A2', '002'),
  ('aa100000-0000-0000-0000-000000000006', 'aa000000-0000-0000-0000-00000000000b', 'teacher', 'Guru B', 'G1'),
  ('aa100000-0000-0000-0000-000000000007', 'aa000000-0000-0000-0000-00000000000b', 'student', 'Murid B', '001'),
  ('aa100000-0000-0000-0000-000000000008', 'aa000000-0000-0000-0000-00000000000c', 'teacher', 'Guru C', 'G1'),
  ('aa100000-0000-0000-0000-000000000009', null, 'super_admin', 'Super Admin', null);

-- Tahun ajaran: A aktif (Y1) & lama (Y0); B; C
insert into public.academic_years (id, tenant_id, name, semester, is_active) values
  ('aa200000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-00000000000a', '2026/2027', 1, true),
  ('aa200000-0000-0000-0000-000000000000', 'aa000000-0000-0000-0000-00000000000a', '2025/2026', 2, false),
  ('aa200000-0000-0000-0000-00000000000b', 'aa000000-0000-0000-0000-00000000000b', '2026/2027', 1, true),
  ('aa200000-0000-0000-0000-00000000000c', 'aa000000-0000-0000-0000-00000000000c', '2026/2027', 1, true);

insert into public.subjects (id, tenant_id, code, name) values
  ('aa300000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-00000000000a', 'MTK', 'Matematika'),
  ('aa300000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-00000000000a', 'BIO', 'Biologi'),
  ('aa300000-0000-0000-0000-00000000000b', 'aa000000-0000-0000-0000-00000000000b', 'MTK', 'Matematika'),
  ('aa300000-0000-0000-0000-00000000000c', 'aa000000-0000-0000-0000-00000000000c', 'MTK', 'Matematika');

-- Kelas: K1 & K2 (Y1), K0 (Y0), KB (sekolah B)
insert into public.classes (id, tenant_id, academic_year_id, name, grade_level) values
  ('aa400000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-00000000000a', 'aa200000-0000-0000-0000-000000000001', 'X 1', 10),
  ('aa400000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-00000000000a', 'aa200000-0000-0000-0000-000000000001', 'X 2', 10),
  ('aa400000-0000-0000-0000-000000000000', 'aa000000-0000-0000-0000-00000000000a', 'aa200000-0000-0000-0000-000000000000', 'X 1', 10),
  ('aa400000-0000-0000-0000-00000000000b', 'aa000000-0000-0000-0000-00000000000b', 'aa200000-0000-0000-0000-00000000000b', 'X 1', 10);

-- Guru A1: MTK di K1 & K0 (tahun lalu), BIO di K2
insert into public.teaching_assignments (tenant_id, teacher_id, subject_id, class_id) values
  ('aa000000-0000-0000-0000-00000000000a', 'aa100000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001'),
  ('aa000000-0000-0000-0000-00000000000a', 'aa100000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000000'),
  ('aa000000-0000-0000-0000-00000000000a', 'aa100000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000002', 'aa400000-0000-0000-0000-000000000002');

-- Soal: QA milik guru A2 (+ opsi), multi essay MA + sub-soal SA, QB sekolah B
insert into public.questions (id, tenant_id, subject_id, created_by, type, content, points) values
  ('aa500000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-00000000000a', 'aa300000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000002', 'true_false', 'QA', 1),
  ('aa500000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-00000000000a', 'aa300000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000002', 'multi_essay', 'MA', 0),
  ('aa500000-0000-0000-0000-00000000000b', 'aa000000-0000-0000-0000-00000000000b', 'aa300000-0000-0000-0000-00000000000b', 'aa100000-0000-0000-0000-000000000006', 'true_false', 'QB', 1);
insert into public.questions (id, tenant_id, subject_id, created_by, parent_id, type, content, points) values
  ('aa500000-0000-0000-0000-000000000003', 'aa000000-0000-0000-0000-00000000000a', 'aa300000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000002', 'aa500000-0000-0000-0000-000000000002', 'essay', 'SA', 1);
insert into public.question_options (id, question_id, label, content, is_correct) values
  ('aa600000-0000-0000-0000-000000000001', 'aa500000-0000-0000-0000-000000000001', 'A', 'Benar', true),
  ('aa600000-0000-0000-0000-00000000000b', 'aa500000-0000-0000-0000-00000000000b', 'A', 'Benar', true);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.new_exam(p_id uuid, p_subject uuid default 'aa300000-0000-0000-0000-000000000001',
  p_year uuid default 'aa200000-0000-0000-0000-000000000001') returns void language sql as $$
  insert into public.exams (id, academic_year_id, subject_id, title, start_at, end_at, duration_minutes)
  values (p_id, p_year, p_subject, 'Ujian', now(), now() + interval '2 hours', 60);
$$;

create function pg_temp.write_score() returns int language sql as $$
  with u as (update public.exam_attempts set final_score = 100 returning 1) select count(*)::int from u;
$$;

set local role authenticated;

-- Guru pemilik ----------------------------------------------------------------------------
select pg_temp.login_as('aa100000-0000-0000-0000-000000000001');
select lives_ok($$select pg_temp.new_exam('aa700000-0000-0000-0000-000000000001')$$, 'Guru membuat ujian (draft)');
select is((select tenant_id from public.exams), 'aa000000-0000-0000-0000-00000000000a'::uuid, 'tenant_id terisi otomatis');
select is((select created_by from public.exams), 'aa100000-0000-0000-0000-000000000001'::uuid, 'created_by = guru');

select lives_ok($$insert into public.exam_classes (exam_id, class_id)
  values ('aa700000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000001')$$,
  'Kelas yang diampu untuk mapel ujian bisa ditambahkan');
select throws_ok($$insert into public.exam_classes (exam_id, class_id)
  values ('aa700000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000002')$$,
  '42501', null, 'Kelas yang diampu untuk mapel LAIN ditolak');
select throws_ok($$insert into public.exam_classes (exam_id, class_id)
  values ('aa700000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-000000000000')$$,
  '42501', null, 'Kelas tahun ajaran lain ditolak');
select throws_ok($$insert into public.exam_classes (exam_id, class_id)
  values ('aa700000-0000-0000-0000-000000000001', 'aa400000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'Kelas sekolah lain ditolak');

select lives_ok($$insert into public.exam_questions (exam_id, question_id, order_no)
  values ('aa700000-0000-0000-0000-000000000001', 'aa500000-0000-0000-0000-000000000001', 1),
         ('aa700000-0000-0000-0000-000000000001', 'aa500000-0000-0000-0000-000000000002', 2)$$,
  'Soal bank sekolah (milik guru lain) bisa dipakai');
select throws_ok($$insert into public.exam_questions (exam_id, question_id, order_no)
  values ('aa700000-0000-0000-0000-000000000001', 'aa500000-0000-0000-0000-000000000003', 3)$$,
  '23514', null, 'Sub-soal tidak bisa dipilih langsung');
select throws_ok($$insert into public.exam_questions (exam_id, question_id, order_no)
  values ('aa700000-0000-0000-0000-000000000001', 'aa500000-0000-0000-0000-00000000000b', 3)$$,
  '23503', null, 'Soal sekolah lain ditolak (FK komposit)');

select lives_ok($$insert into public.exam_participants (exam_id, student_id)
  values ('aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000004')$$, 'Murid ditambahkan sebagai peserta');
select throws_ok($$insert into public.exam_participants (exam_id, student_id)
  values ('aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000002')$$,
  '23514', null, 'Guru tidak bisa jadi peserta');
select throws_ok($$insert into public.exam_participants (exam_id, student_id)
  values ('aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000007')$$,
  '23514', null, 'Murid sekolah lain ditolak (profilnya tak terlihat → cek peran gagal)');

select throws_ok($$update public.exams set status = 'published'$$, '23514', null, 'Terbit tanpa token ditolak');
select lives_ok($$update public.exams set status = 'published', access_token = 'ABC234'$$, 'Terbit dengan token');
select throws_ok($$update public.exams set access_token = 'ABCD10'$$, '23514', null, 'Token dengan 0/1 ditolak');
select throws_ok($$insert into public.exams (academic_year_id, subject_id, title, start_at, end_at, duration_minutes, exam_type)
  values ('aa200000-0000-0000-0000-000000000001', 'aa300000-0000-0000-0000-000000000001', 'R', now(), now() + interval '1 hour', 60, 'remedial')$$,
  '23514', null, 'Remedial tanpa ujian induk ditolak');
select throws_ok($$select pg_temp.new_exam('aa700000-0000-0000-0000-000000000009', 'aa300000-0000-0000-0000-00000000000b')$$,
  '23503', null, 'Mapel sekolah lain ditolak (FK komposit)');

-- Attempt & jawaban (dibuat sebagai postgres; nanti oleh RPC) --------------------------------
reset role;
insert into public.exam_attempts (id, tenant_id, exam_id, student_id, deadline_at) values
  ('aa800000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-00000000000a',
   'aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000004', now() + interval '1 hour');
insert into public.attempt_answers (tenant_id, attempt_id, question_id, selected_option_id) values
  ('aa000000-0000-0000-0000-00000000000a', 'aa800000-0000-0000-0000-000000000001',
   'aa500000-0000-0000-0000-000000000001', 'aa600000-0000-0000-0000-000000000001');

select throws_ok($$insert into public.exam_attempts (tenant_id, exam_id, student_id, attempt_no, deadline_at) values
  ('aa000000-0000-0000-0000-00000000000a', 'aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000004', 2, now())$$,
  '23505', null, 'Dua attempt aktif untuk murid yang sama ditolak');
select throws_ok($$insert into public.exam_attempts (tenant_id, exam_id, student_id, deadline_at) values
  ('aa000000-0000-0000-0000-00000000000a', 'aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000005', now())$$,
  '23503', null, 'Attempt murid bukan peserta ditolak');
select throws_ok($$insert into public.attempt_answers (tenant_id, attempt_id, question_id, selected_option_id) values
  ('aa000000-0000-0000-0000-00000000000a', 'aa800000-0000-0000-0000-000000000001',
   'aa500000-0000-0000-0000-000000000002', 'aa600000-0000-0000-0000-000000000001')$$,
  '23503', null, 'Opsi milik soal lain ditolak');
set local role authenticated;

select pg_temp.login_as('aa100000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.exam_attempts), 1, 'Guru pemilik melihat attempt ujiannya');
select throws_ok($$delete from public.exams where id = 'aa700000-0000-0000-0000-000000000001'$$,
  '23503', null, 'Ujian yang sudah punya attempt tidak bisa dihapus');
-- UPDATE tanpa policy tulis = 0 baris (bukan error)
select is(pg_temp.write_score(), 0,
  'Guru tidak bisa menulis nilai attempt langsung');

-- Guru lain, Admin, sekolah lain, sekolah nonaktif, Super Admin ------------------------------
select pg_temp.login_as('aa100000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.exams), 0, 'Guru lain tidak melihat ujian guru A1');
select throws_ok($$insert into public.exam_questions (exam_id, question_id, order_no)
  values ('aa700000-0000-0000-0000-000000000001', 'aa500000-0000-0000-0000-000000000001', 9)$$,
  '42501', null, 'Guru lain tidak bisa mengubah soal ujian guru A1');

select pg_temp.login_as('aa100000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.exams) + (select count(*)::int from public.exam_classes)
  + (select count(*)::int from public.exam_questions) + (select count(*)::int from public.exam_attempts)
  + (select count(*)::int from public.attempt_answers), 6, 'Admin Sekolah membaca ujian, kelas, soal, attempt, jawaban');
-- Ditolak trigger peran (23514) sebelum RLS (42501); yang penting ditolak
select throws_ok($$select pg_temp.new_exam('aa700000-0000-0000-0000-000000000002')$$, null, null,
  'Admin Sekolah tidak bisa membuat ujian');

select pg_temp.login_as('aa100000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.exams) + (select count(*)::int from public.exam_attempts), 0,
  'Sekolah lain tidak melihat apa pun');

select pg_temp.login_as('aa100000-0000-0000-0000-000000000008');
select throws_ok($$select pg_temp.new_exam('aa700000-0000-0000-0000-00000000000c', 'aa300000-0000-0000-0000-00000000000c',
  'aa200000-0000-0000-0000-00000000000c')$$, null, null, 'Guru sekolah nonaktif tidak bisa membuat ujian');

select pg_temp.login_as('aa100000-0000-0000-0000-000000000009');
select is((select count(*)::int from public.exams where tenant_id::text like 'aa000000-%'), 1, 'Super Admin melihat semua ujian');

-- Murid -------------------------------------------------------------------------------------
select pg_temp.login_as('aa100000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.exams) + (select count(*)::int from public.exam_questions)
  + (select count(*)::int from public.exam_classes) + (select count(*)::int from public.exam_participants), 0,
  'Murid tidak membaca ujian/soal/kelas/peserta langsung (token & kunci aman)');
select is((select count(*)::int from public.exam_attempts) + (select count(*)::int from public.attempt_answers), 0,
  'Sebelum publikasi murid tidak melihat attempt & jawabannya');
select throws_ok($$insert into public.exam_attempts (tenant_id, exam_id, student_id, deadline_at) values
  ('aa000000-0000-0000-0000-00000000000a', 'aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000004', now())$$,
  '42501', null, 'Murid tidak bisa membuat attempt langsung');

reset role;
update public.exam_attempts set status = 'submitted', submitted_at = now(), final_score = 80, is_published = true;
set local role authenticated;
select pg_temp.login_as('aa100000-0000-0000-0000-000000000004');
select is((select final_score from public.exam_attempts), 80.00::numeric, 'Setelah publikasi murid melihat nilainya');
select is((select count(*)::int from public.attempt_answers), 1, 'Setelah publikasi murid melihat jawabannya');
select pg_temp.login_as('aa100000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.exam_attempts), 0, 'Murid lain tidak melihat nilai teman');

-- Ujian ulang: attempt lama dibatalkan → attempt baru boleh
reset role;
update public.exam_attempts set is_voided = true;
select lives_ok($$insert into public.exam_attempts (tenant_id, exam_id, student_id, attempt_no, deadline_at) values
  ('aa000000-0000-0000-0000-00000000000a', 'aa700000-0000-0000-0000-000000000001', 'aa100000-0000-0000-0000-000000000004', 2, now())$$,
  'Setelah attempt lama dibatalkan, attempt ke-2 bisa dibuat');

select * from finish();
rollback;
