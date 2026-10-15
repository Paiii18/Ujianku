-- F2.7 — Bank soal: questions (+ sub-soal multi essay), question_options, question_pairs, import_jobs.
-- Akses (PRD matriks + DEC-028): guru mengelola soal miliknya; guru lain & Admin Sekolah di sekolah
-- yang sama hanya baca; Super Admin baca; MURID TIDAK PUNYA AKSES SAMA SEKALI (kunci jawaban ada di
-- tabel ini — murid nanti mengambil soal lewat RPC get_exam_questions() tanpa kunci, F3.7).

create type public.question_type as enum (
  'multiple_choice', -- PG: 2–5 opsi, satu benar
  'true_false',      -- BS: opsi A = Benar, B = Salah
  'short_answer',    -- ISIAN: accepted_answers
  'matching',        -- JODOH: question_pairs
  'essay',           -- ESSAY: answer_key + keywords
  'multi_essay'      -- MULTI: induk; sub-soal = baris essay dengan parent_id
);

create type public.import_status as enum ('processing', 'success', 'failed');

-- questions ---------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants (id),
  subject_id uuid not null,
  created_by uuid not null default auth.uid(),
  parent_id uuid,
  position smallint not null default 0, -- urutan sub-soal di dalam induk multi essay
  type public.question_type not null,
  content text not null check (length(trim(content)) between 1 and 10000),
  image_path text,
  -- Induk multi essay: poin = jumlah poin sub-soal (dihitung editor/RPC), boleh 0.
  points numeric(6, 2) not null default 1
    check (points > 0 or (type = 'multi_essay' and points = 0)),
  answer_key text,          -- essay: jawaban acuan
  accepted_answers text[],  -- isian: jawaban yang diterima
  keywords text[],          -- essay: kata kunci
  explanation text,         -- pembahasan
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (subject_id, tenant_id) references public.subjects (id, tenant_id),
  foreign key (created_by, tenant_id) references public.profiles (id, tenant_id),
  -- Hapus induk = sub-soalnya ikut terhapus
  foreign key (parent_id, tenant_id) references public.questions (id, tenant_id) on delete cascade,
  check (parent_id is null or type = 'essay')
);

create index questions_tenant_id_idx on public.questions (tenant_id);
create index questions_subject_id_idx on public.questions (subject_id);
create index questions_created_by_idx on public.questions (created_by);
create index questions_parent_id_idx on public.questions (parent_id);

create trigger questions_created_by_teacher
  before insert or update of created_by on public.questions
  for each row execute function public.assert_profile_role('created_by', 'teacher');

-- Sub-soal: induk harus multi essay milik guru & mapel yang sama.
create function public.check_question_parent()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from questions p
    where p.id = new.parent_id
      and p.type = 'multi_essay'
      and p.created_by = new.created_by
      and p.subject_id = new.subject_id
  ) then
    raise exception 'Induk sub-soal harus soal multi essay milik guru & mapel yang sama'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger questions_check_parent
  before insert or update of parent_id, created_by, subject_id on public.questions
  for each row execute function public.check_question_parent();

-- question_options (PG & BS) ----------------------------------------------------
-- Tanpa tenant_id: akses mengikuti soal induknya (subquery ke questions juga terkena RLS).

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label char(1) not null check (label in ('A', 'B', 'C', 'D', 'E')),
  content text not null default '' check (length(content) <= 2000),
  image_path text,
  is_correct boolean not null default false,
  unique (question_id, label)
);

-- question_pairs (menjodohkan) --------------------------------------------------
-- right_key: kunci acak sisi kanan; murid menerima pilihan kanan beserta right_key teracak,
-- bukan id pasangan, sehingga kunci tidak bocor (F3.7).

create table public.question_pairs (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position smallint not null default 0,
  left_text text not null check (length(trim(left_text)) between 1 and 500),
  right_text text not null check (length(trim(right_text)) between 1 and 500),
  right_key uuid not null unique default gen_random_uuid()
);

create index question_pairs_question_id_idx on public.question_pairs (question_id);

-- import_jobs -------------------------------------------------------------------

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants (id),
  uploaded_by uuid not null default auth.uid(),
  file_name text not null,
  status public.import_status not null default 'processing',
  total_rows integer not null default 0,
  imported_count integer not null default 0,
  errors jsonb not null default '[]', -- [{"row": 3, "errors": ["..."]}, ...]
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (uploaded_by, tenant_id) references public.profiles (id, tenant_id)
);

create index import_jobs_tenant_id_idx on public.import_jobs (tenant_id);
create index import_jobs_uploaded_by_idx on public.import_jobs (uploaded_by);

create trigger import_jobs_uploaded_by_teacher
  before insert or update of uploaded_by on public.import_jobs
  for each row execute function public.assert_profile_role('uploaded_by', 'teacher');

-- RLS ---------------------------------------------------------------------------

alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_pairs enable row level security;
alter table public.import_jobs enable row level security;

-- Baca: Super Admin; Admin Sekolah & guru di sekolah sendiri (tenant aktif). Murid: tidak ada.
create policy questions_select on public.questions for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      tenant_id = (select public.my_tenant())
      and (select public.tenant_is_active())
      and (select public.my_role()) in ('school_admin', 'teacher')
    )
  );

-- Tulis: hanya guru pembuatnya. WITH CHECK juga mencegah memindah soal ke guru/sekolah lain.
create policy questions_write on public.questions for all to authenticated
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

-- Opsi & pasangan: baca bila soalnya terbaca; tulis bila soalnya milik sendiri.
do $$
declare
  t text;
begin
  foreach t in array array['question_options', 'question_pairs'] loop
    execute format($p$
      create policy %1$I on public.%2$I for select to authenticated
      using (exists (select 1 from public.questions q where q.id = question_id))
    $p$, t || '_select', t);

    execute format($p$
      create policy %1$I on public.%2$I for all to authenticated
      using (exists (
        select 1 from public.questions q
        where q.id = question_id and q.created_by = (select auth.uid())
      ))
      with check (exists (
        select 1 from public.questions q
        where q.id = question_id and q.created_by = (select auth.uid())
      ))
    $p$, t || '_write', t);
  end loop;
end;
$$;

-- Riwayat import: guru miliknya; Admin Sekolah & Super Admin baca. Tidak ada DELETE (riwayat).
create policy import_jobs_select on public.import_jobs for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      tenant_id = (select public.my_tenant())
      and (select public.tenant_is_active())
      and (
        uploaded_by = (select auth.uid())
        or (select public.my_role()) = 'school_admin'
      )
    )
  );

create policy import_jobs_insert on public.import_jobs for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and tenant_id = (select public.my_tenant())
    and (select public.tenant_is_active())
    and (select public.my_role()) = 'teacher'
  );

create policy import_jobs_update on public.import_jobs for update to authenticated
  using (
    uploaded_by = (select auth.uid())
    and tenant_id = (select public.my_tenant())
    and (select public.tenant_is_active())
  )
  with check (
    uploaded_by = (select auth.uid())
    and tenant_id = (select public.my_tenant())
  );
