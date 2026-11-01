-- F3.8 — Halaman ujian murid.
-- * my_exams + attempt_id: tombol "Lanjutkan" langsung ke halaman pengerjaan.
-- * in_exam_grace(): murid sekolah nonaktif yang sedang mengerjakan ujian dalam masa tenggang
--   (DEC-043) tetap boleh membuka halaman pengerjaan (proxy & gSSP).

drop function public.my_exams();

create function public.my_exams()
returns table (
  id uuid,
  title text,
  subject_name text,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes smallint,
  attempt_id uuid, -- NULL = belum mulai
  attempt_status public.attempt_status
)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.title, s.name, e.start_at, e.end_at, e.duration_minutes, a.id, a.status
  from exam_participants ep
  join exams e on e.id = ep.exam_id
  join subjects s on s.id = e.subject_id
  join academic_years y on y.id = e.academic_year_id and y.is_active
  left join exam_attempts a on a.exam_id = e.id and a.student_id = ep.student_id and not a.is_voided
  where ep.student_id = auth.uid()
    and e.status = 'published'
    and e.tenant_id = my_tenant()
    and my_role() = 'student'
    and tenant_is_active()
  order by e.start_at, e.title;
$$;

create function public.in_exam_grace()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from exam_attempts a
    where a.student_id = auth.uid()
      and not a.is_voided
      and a.status = 'in_progress'
      and a.deadline_at > now()
      and public.student_exam_open(a.exam_id)
  );
$$;

revoke execute on function public.my_exams(), public.in_exam_grace() from public, anon;
grant execute on function public.my_exams(), public.in_exam_grace() to authenticated;
