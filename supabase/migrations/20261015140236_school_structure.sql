-- F2.1 — Struktur sekolah: academic_years, subjects, classes, class_students, teaching_assignments.
-- Isolasi tenant dua lapis:
--   1. RLS: hanya baris tenant sendiri (tenant aktif); tulis hanya Admin Sekolah / Super Admin.
--   2. Foreign key komposit (kolom_id, tenant_id): baris yang dirujuk WAJIB dari tenant yang sama,
--      jadi Admin A tidak bisa memasang guru/murid/kelas sekolah B walau tahu UUID-nya.
--      (Mirip FK komposit di MySQL; FK dicek Postgres tanpa RLS, jadi tetap berlaku.)
-- tenant_id default my_tenant(): client tidak perlu (dan tidak dipercaya untuk) mengirimnya;
-- policy WITH CHECK memastikan nilainya = tenant user.

-- Target FK komposit: pasangan (id, tenant_id) harus unik.
alter table public.profiles add constraint profiles_id_tenant_key unique (id, tenant_id);

-- Validasi peran profil yang dirujuk (FK hanya bisa cek keberadaan, bukan peran).
-- Argumen trigger: nama kolom, peran wajib. Contoh: ('student_id', 'student').
create function public.assert_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  ref_id uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if ref_id is not null and not exists (
    select 1 from profiles where id = ref_id and role = tg_argv[1]::user_role
  ) then
    raise exception '% harus akun dengan peran %', tg_argv[0], tg_argv[1] using errcode = '23514';
  end if;
  return new;
end;
$$;

-- academic_years --------------------------------------------------------------

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants (id),
  name text not null check (name ~ '^\d{4}/\d{4}$'), -- '2026/2027'
  semester smallint not null check (semester in (1, 2)), -- 1 = Ganjil, 2 = Genap
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, name, semester),
  unique (id, tenant_id)
);

-- Hanya satu tahun ajaran aktif per sekolah (partial unique index).
create unique index academic_years_one_active_idx on public.academic_years (tenant_id) where is_active;

-- subjects --------------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants (id),
  code text not null check (code ~ '^[A-Z0-9]{2,10}$'), -- dipakai kolom kode_mapel di import soal
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (id, tenant_id)
);

-- classes ---------------------------------------------------------------------

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants (id),
  academic_year_id uuid not null,
  homeroom_teacher_id uuid,
  name text not null check (length(trim(name)) > 0),
  grade_level smallint not null check (grade_level between 1 and 12),
  created_at timestamptz not null default now(),
  foreign key (academic_year_id, tenant_id) references public.academic_years (id, tenant_id),
  -- NULL = belum ada wali kelas (FK komposit dengan NULL tidak dicek)
  foreign key (homeroom_teacher_id, tenant_id) references public.profiles (id, tenant_id),
  unique (academic_year_id, name),
  unique (id, tenant_id),
  unique (id, academic_year_id, tenant_id)
);

create index classes_tenant_id_idx on public.classes (tenant_id);
create index classes_homeroom_teacher_id_idx on public.classes (homeroom_teacher_id);

create trigger classes_homeroom_is_teacher
  before insert or update of homeroom_teacher_id on public.classes
  for each row execute function public.assert_profile_role('homeroom_teacher_id', 'teacher');

-- class_students --------------------------------------------------------------
-- academic_year_id & tenant_id disalin dari kelas (trigger), agar unique
-- (academic_year_id, student_id) menegakkan "satu murid satu kelas per tahun ajaran".

create table public.class_students (
  class_id uuid not null,
  student_id uuid not null,
  tenant_id uuid not null,
  academic_year_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id),
  foreign key (class_id, academic_year_id, tenant_id)
    references public.classes (id, academic_year_id, tenant_id) on update cascade,
  foreign key (student_id, tenant_id) references public.profiles (id, tenant_id),
  unique (academic_year_id, student_id)
);

create index class_students_tenant_id_idx on public.class_students (tenant_id);
create index class_students_student_id_idx on public.class_students (student_id);

create function public.fill_class_student()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- dibaca dengan hak user (RLS): kelas sekolah lain tidak terlihat → ditolak
  select tenant_id, academic_year_id into new.tenant_id, new.academic_year_id
  from classes where id = new.class_id;
  if not found then
    raise exception 'Kelas tidak ditemukan' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger class_students_fill
  before insert or update of class_id on public.class_students
  for each row execute function public.fill_class_student();

create trigger class_students_is_student
  before insert or update of student_id on public.class_students
  for each row execute function public.assert_profile_role('student_id', 'student');

-- teaching_assignments --------------------------------------------------------

create table public.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.my_tenant() references public.tenants (id),
  teacher_id uuid not null,
  subject_id uuid not null,
  class_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (teacher_id, tenant_id) references public.profiles (id, tenant_id),
  foreign key (subject_id, tenant_id) references public.subjects (id, tenant_id),
  foreign key (class_id, tenant_id) references public.classes (id, tenant_id),
  unique (teacher_id, subject_id, class_id)
);

create index teaching_assignments_tenant_id_idx on public.teaching_assignments (tenant_id);
create index teaching_assignments_subject_id_idx on public.teaching_assignments (subject_id);
create index teaching_assignments_class_id_idx on public.teaching_assignments (class_id);

create trigger teaching_assignments_is_teacher
  before insert or update of teacher_id on public.teaching_assignments
  for each row execute function public.assert_profile_role('teacher_id', 'teacher');

-- RLS -------------------------------------------------------------------------
-- Sama untuk kelima tabel (matriks akses PRD):
--   <tabel>_select : Super Admin semua; Admin Sekolah & guru baca tenant sendiri (tenant aktif).
--   <tabel>_write  : Super Admin semua; Admin Sekolah tulis/hapus tenant sendiri (tenant aktif).
-- Murid belum diberi akses (matriks: "—"); data yang ia perlukan nanti lewat RPC/policy di F3.
-- DELETE diizinkan: data yang masih dirujuk (kelas berisi murid, mapel dipakai) ditolak FK.

do $$
declare
  t text;
begin
  foreach t in array array['academic_years', 'subjects', 'classes', 'class_students', 'teaching_assignments'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format($p$
      create policy %1$I on public.%2$I for select to authenticated
      using (
        (select public.is_super_admin())
        or (
          tenant_id = (select public.my_tenant())
          and (select public.tenant_is_active())
          and (select public.my_role()) in ('school_admin', 'teacher')
        )
      )$p$, t || '_select', t);

    execute format($p$
      create policy %1$I on public.%2$I for all to authenticated
      using (
        (select public.is_super_admin())
        or (
          tenant_id = (select public.my_tenant())
          and (select public.tenant_is_active())
          and (select public.my_role()) = 'school_admin'
        )
      )
      with check (
        (select public.is_super_admin())
        or (
          tenant_id = (select public.my_tenant())
          and (select public.tenant_is_active())
          and (select public.my_role()) = 'school_admin'
        )
      )$p$, t || '_write', t);
  end loop;
end;
$$;
