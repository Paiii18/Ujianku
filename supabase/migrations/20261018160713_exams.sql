-- F3.1 — Ujian: exams, exam_classes, exam_participants, exam_questions, exam_attempts, attempt_answers.
-- Isolasi tenant dua lapis seperti F2.1 (DEC-021): RLS + FK komposit (kolom_id, tenant_id).
-- Hak akses (PRD + DEC-028):
--   * Guru     : kelola ujian MILIKNYA (draft, kelas, peserta, soal); baca attempt/jawaban ujiannya.
--   * Admin    : baca semua ujian sekolahnya (tanpa menulis).
--   * Super Admin: baca semua.
--   * Murid    : TIDAK ada akses langsung ke exams/exam_questions (token & soal lewat RPC, F3.6/F3.7);
--                attempt & jawaban sendiri hanya terbaca setelah nilai dipublikasikan (F3.14, dicek di RLS).
-- exam_attempts & attempt_answers tidak punya policy tulis: mulai, simpan jawaban, submit, koreksi
-- semuanya lewat RPC SECURITY DEFINER (F3.7–F3.13) — nilai & waktu hanya dihitung server.

create type public.exam_type as enum ('regular', 'remedial');
create type public.exam_status as enum ('draft', 'published');
create type public.attempt_status as enum ('in_progress', 'submitted');
-- Mode tampil nilai ke murid setelah publikasi: tidak ditampilkan / nilai saja / nilai + pembahasan
create type public.score_visibility as enum ('hidden', 'score', 'score_and_review');

-- Target FK komposit
alter table public.question_options add constraint question_options_id_question_key unique (id, question_id);

-- exams -------------------------------------------------------------------------

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants (id),
  academic_year_id uuid not null,
  subject_id uuid not null,
  created_by uuid not null default auth.uid(),
  parent_exam_id uuid, -- remedial: ujian induk
  exam_type public.exam_type not null default 'regular',
  title text not null check (length(trim(title)) between 1 and 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_minutes smallint not null check (duration_minutes between 1 and 600),
  kkm numeric(5, 2) not null default 75 check (kkm between 0 and 100),
  -- Token 6 karakter tanpa karakter ambigu 0/O/1/I (F3.4); dibuat saat terbit
  access_token char(6) check (access_token ~ '^[A-HJ-NP-Z2-9]{6}$'),
  status public.exam_status not null default 'draft',
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  require_fullscreen boolean not null default true,
  max_tab_switches smallint check (max_tab_switches between 1 and 100), -- NULL = tanpa auto-submit
  essay_threshold numeric(3, 2) not null default 0.80 check (essay_threshold between 0 and 1),
  score_visibility public.score_visibility not null default 'score',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  check ((exam_type = 'remedial') = (parent_exam_id is not null)),
  check (status = 'draft' or access_token is not null),
  unique (id, tenant_id),
  foreign key (academic_year_id, tenant_id) references public.academic_years (id, tenant_id),
  foreign key (subject_id, tenant_id) references public.subjects (id, tenant_id),
  foreign key (created_by, tenant_id) references public.profiles (id, tenant_id),
  foreign key (parent_exam_id, tenant_id) references public.exams (id, tenant_id)
);

create index exams_tenant_id_idx on public.exams (tenant_id);
create index exams_academic_year_id_idx on public.exams (academic_year_id);
create index exams_subject_id_idx on public.exams (subject_id);
create index exams_created_by_idx on public.exams (created_by);
create index exams_parent_exam_id_idx on public.exams (parent_exam_id);

create trigger exams_created_by_teacher
  before insert or update of created_by on public.exams
  for each row execute function public.assert_profile_role('created_by', 'teacher');

-- exam_classes ------------------------------------------------------------------

create table public.exam_classes (
  exam_id uuid not null,
  class_id uuid not null,
  tenant_id uuid not null default public.my_tenant(),
  created_at timestamptz not null default now(),
  primary key (exam_id, class_id),
  foreign key (exam_id, tenant_id) references public.exams (id, tenant_id) on delete cascade,
  foreign key (class_id, tenant_id) references public.classes (id, tenant_id)
);

create index exam_classes_tenant_id_idx on public.exam_classes (tenant_id);
create index exam_classes_class_id_idx on public.exam_classes (class_id);

-- exam_participants -------------------------------------------------------------
-- Daftar peserta final; diisi trigger dari exam_classes (F3.2) + tambahan per murid.

create table public.exam_participants (
  exam_id uuid not null,
  student_id uuid not null,
  tenant_id uuid not null default public.my_tenant(),
  created_at timestamptz not null default now(),
  primary key (exam_id, student_id),
  foreign key (exam_id, tenant_id) references public.exams (id, tenant_id) on delete cascade,
  foreign key (student_id, tenant_id) references public.profiles (id, tenant_id)
);

create index exam_participants_tenant_id_idx on public.exam_participants (tenant_id);
create index exam_participants_student_id_idx on public.exam_participants (student_id);

create trigger exam_participants_is_student
  before insert or update of student_id on public.exam_participants
  for each row execute function public.assert_profile_role('student_id', 'student');

-- exam_questions ----------------------------------------------------------------
-- Soal dari bank soal sekolah (milik guru mana pun, F2.12); hanya soal induk (bukan sub-soal).

create table public.exam_questions (
  exam_id uuid not null,
  question_id uuid not null,
  tenant_id uuid not null default public.my_tenant(),
  order_no smallint not null check (order_no >= 1),
  points numeric(6, 2) check (points > 0), -- NULL = poin dari bank soal
  primary key (exam_id, question_id),
  unique (exam_id, order_no) deferrable initially deferred, -- urutan bisa ditukar dalam satu transaksi
  foreign key (exam_id, tenant_id) references public.exams (id, tenant_id) on delete cascade,
  foreign key (question_id, tenant_id) references public.questions (id, tenant_id)
);

create index exam_questions_tenant_id_idx on public.exam_questions (tenant_id);
create index exam_questions_question_id_idx on public.exam_questions (question_id);

create function public.check_exam_question()
returns trigger
language plpgsql
security definer -- cek parent_id tanpa bergantung RLS pembaca
set search_path = public
as $$
begin
  if exists (select 1 from questions where id = new.question_id and parent_id is not null) then
    raise exception 'Sub-soal tidak bisa dipilih langsung; pilih soal multi essay induknya'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger exam_questions_top_level
  before insert or update of question_id on public.exam_questions
  for each row execute function public.check_exam_question();

-- exam_attempts -----------------------------------------------------------------

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  exam_id uuid not null,
  student_id uuid not null,
  attempt_no smallint not null default 1 check (attempt_no >= 1),
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null, -- min(mulai + durasi, end_at), dihitung RPC (F3.7)
  submitted_at timestamptz,
  session_id uuid not null default gen_random_uuid(), -- diputar tiap start dari perangkat baru (F3.9)
  tab_switch_count smallint not null default 0 check (tab_switch_count >= 0),
  final_score numeric(5, 2) check (final_score between 0 and 100),
  is_published boolean not null default false,
  is_voided boolean not null default false, -- ujian ulang (F4.3): attempt lama dibatalkan, tidak dihapus
  created_at timestamptz not null default now(),
  check ((status = 'submitted') = (submitted_at is not null)),
  unique (id, tenant_id),
  unique (exam_id, student_id, attempt_no),
  -- Hanya peserta yang bisa punya attempt
  foreign key (exam_id, student_id) references public.exam_participants (exam_id, student_id),
  foreign key (exam_id, tenant_id) references public.exams (id, tenant_id),
  foreign key (student_id, tenant_id) references public.profiles (id, tenant_id)
);

-- Satu attempt aktif (belum dibatalkan) per murid per ujian
create unique index exam_attempts_one_valid_idx on public.exam_attempts (exam_id, student_id) where not is_voided;
create index exam_attempts_tenant_id_idx on public.exam_attempts (tenant_id);
create index exam_attempts_student_id_idx on public.exam_attempts (student_id);

-- attempt_answers ---------------------------------------------------------------
-- Satu baris per soal yang dijawab (sub-soal multi essay = baris sendiri).

create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  attempt_id uuid not null,
  question_id uuid not null,
  selected_option_id uuid, -- PG & B/S
  answer_text text check (length(answer_text) <= 20000), -- isian & essay
  answer_json jsonb, -- menjodohkan: {"<pair_id>": "<right_key>", ...}
  auto_points numeric(6, 2) check (auto_points >= 0),
  manual_points numeric(6, 2) check (manual_points >= 0), -- koreksi guru (F3.13), menimpa auto_points
  similarity numeric(4, 3) check (similarity between 0 and 1), -- essay: skor pg_trgm (F3.11)
  needs_review boolean not null default false,
  review_note text check (length(review_note) <= 2000),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id),
  foreign key (attempt_id, tenant_id) references public.exam_attempts (id, tenant_id),
  foreign key (question_id, tenant_id) references public.questions (id, tenant_id),
  -- Opsi harus milik soal yang dijawab
  foreign key (selected_option_id, question_id) references public.question_options (id, question_id)
);

create index attempt_answers_tenant_id_idx on public.attempt_answers (tenant_id);
create index attempt_answers_question_id_idx on public.attempt_answers (question_id);
create index attempt_answers_needs_review_idx on public.attempt_answers (attempt_id) where needs_review;

-- RLS ---------------------------------------------------------------------------

alter table public.exams enable row level security;
alter table public.exam_classes enable row level security;
alter table public.exam_participants enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- Ujian yang boleh dibaca user ini sebagai staf: Super Admin semua; Admin Sekolah sekolahnya;
-- guru ujian miliknya. SECURITY DEFINER agar policy tabel anak tidak saling memicu RLS berulang.
create function public.can_read_exam(p_exam_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_super_admin() or exists (
    select 1 from exams e
    where e.id = p_exam_id
      and e.tenant_id = my_tenant()
      and tenant_is_active()
      and (my_role() = 'school_admin' or (my_role() = 'teacher' and e.created_by = auth.uid()))
  );
$$;

-- Ujian milik guru ini (boleh diubah)
create function public.owns_exam(p_exam_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from exams e
    where e.id = p_exam_id
      and e.created_by = auth.uid()
      and e.tenant_id = my_tenant()
      and tenant_is_active()
      and my_role() = 'teacher'
  );
$$;

revoke execute on function public.can_read_exam(uuid), public.owns_exam(uuid) from public, anon;
grant execute on function public.can_read_exam(uuid), public.owns_exam(uuid) to authenticated;

-- exams
create policy exams_select on public.exams for select to authenticated
  using ((select public.can_read_exam(id)));

create policy exams_write on public.exams for all to authenticated
  using (
    created_by = (select auth.uid())
    and tenant_id = (select public.my_tenant())
    and (select public.tenant_is_active())
    and (select public.my_role()) = 'teacher'
  )
  with check (
    created_by = (select auth.uid())
    and tenant_id = (select public.my_tenant())
    and (select public.tenant_is_active())
    and (select public.my_role()) = 'teacher'
  );

-- exam_classes: guru hanya boleh menambah kelas yang ia ampu untuk mapel ujian itu,
-- di tahun ajaran ujian itu (PRD: penugasan guru; architecture F3.1).
create policy exam_classes_select on public.exam_classes for select to authenticated
  using ((select public.can_read_exam(exam_id)));

create policy exam_classes_insert on public.exam_classes for insert to authenticated
  with check (
    (select public.owns_exam(exam_id))
    and exists (
      select 1
      from public.exams e
      join public.teaching_assignments ta
        on ta.subject_id = e.subject_id and ta.teacher_id = (select auth.uid())
      join public.classes c
        on c.id = ta.class_id and c.academic_year_id = e.academic_year_id
      where e.id = exam_id and ta.class_id = exam_classes.class_id
    )
  );

create policy exam_classes_delete on public.exam_classes for delete to authenticated
  using ((select public.owns_exam(exam_id)));

-- exam_participants, exam_questions: baca = staf yang boleh membaca ujian; tulis = pemilik ujian
do $$
declare
  t text;
begin
  foreach t in array array['exam_participants', 'exam_questions'] loop
    execute format($p$
      create policy %1$I on public.%2$I for select to authenticated
      using ((select public.can_read_exam(exam_id)))
    $p$, t || '_select', t);

    execute format($p$
      create policy %1$I on public.%2$I for all to authenticated
      using ((select public.owns_exam(exam_id)))
      with check ((select public.owns_exam(exam_id)))
    $p$, t || '_write', t);
  end loop;
end;
$$;

-- exam_attempts & attempt_answers: hanya baca (tulis lewat RPC)
create policy exam_attempts_select on public.exam_attempts for select to authenticated
  using (
    (select public.can_read_exam(exam_id))
    or (
      student_id = (select auth.uid())
      and is_published
      and tenant_id = (select public.my_tenant())
      and (select public.tenant_is_active())
    )
  );

create policy attempt_answers_select on public.attempt_answers for select to authenticated
  using (
    exists (select 1 from public.exam_attempts a where a.id = attempt_id) -- RLS exam_attempts berlaku
  );
