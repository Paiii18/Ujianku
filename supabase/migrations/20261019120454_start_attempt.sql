-- F3.7 — Murid memulai ujian & mengambil soal.
-- * start_attempt(exam, token): buat attempt baru atau lanjutkan yang ada (sesi diputar, DEC-003).
-- * get_exam_questions(attempt): soal tanpa kunci jawaban (is_correct, answer_key, accepted_answers,
--   keywords, explanation, pasangan benar) + jawaban tersimpan untuk melanjutkan.
-- * Urutan acak per attempt = md5(attempt_id || id): sama setiap refresh tanpa kolom tambahan.
-- * Masa tenggang PRD: ujian yang sudah dimulai sebelum masa aktif sekolah habis tetap bisa
--   dikerjakan sampai end_at (DEC-015).

-- Ujian terbit ini boleh dipakai murid yang login sekarang: murid aktif di sekolah ujian, dan
-- sekolah aktif ATAU masa tenggang. Kepesertaan dicek terpisah oleh pemanggil.
create function public.student_exam_open(p_exam_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from exams e
    join profiles p on p.id = auth.uid() and p.tenant_id = e.tenant_id
    join tenants t on t.id = e.tenant_id
    where e.id = p_exam_id
      and e.status = 'published'
      and p.role = 'student'
      and p.is_active
      and (
        (t.status = 'active' and t.active_until > now())
        or (e.start_at < t.active_until and now() < e.end_at)
      )
  );
$$;

create function public.start_attempt(p_exam_id uuid, p_token text)
returns table (attempt_id uuid, deadline_at timestamptz, session_id uuid)
language plpgsql security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_exam exams;
  v_attempt exam_attempts;
begin
  -- Kunci baris peserta: dua klik "Mulai" bersamaan tidak membuat dua attempt
  select e.* into v_exam
  from exams e
  join exam_participants ep on ep.exam_id = e.id and ep.student_id = auth.uid()
  where e.id = p_exam_id and public.student_exam_open(e.id)
  for update of ep;

  if not found then
    raise exception 'Ujian tidak ditemukan' using errcode = '22023';
  end if;
  if now() < v_exam.start_at then
    raise exception 'Ujian belum dimulai' using errcode = '22023';
  end if;
  if now() >= v_exam.end_at then
    raise exception 'Ujian sudah berakhir' using errcode = '22023';
  end if;
  if upper(regexp_replace(coalesce(p_token, ''), '\s', '', 'g')) is distinct from v_exam.access_token then
    raise exception 'Token salah' using errcode = '22023';
  end if;

  select a.* into v_attempt
  from exam_attempts a
  where a.exam_id = p_exam_id and a.student_id = auth.uid() and not a.is_voided;

  if found then
    if v_attempt.status = 'submitted' then
      raise exception 'Ujian sudah dikumpulkan' using errcode = '22023';
    end if;
    if v_attempt.deadline_at <= now() then
      raise exception 'Waktu ujian sudah habis' using errcode = '22023';
    end if;
    -- Lanjutkan: sesi baru, perangkat lama tidak bisa menyimpan lagi (F3.9)
    update exam_attempts a set session_id = gen_random_uuid()
    where a.id = v_attempt.id
    returning a.* into v_attempt;
  else
    insert into exam_attempts (tenant_id, exam_id, student_id, attempt_no, deadline_at)
    values (
      v_exam.tenant_id, v_exam.id, auth.uid(),
      coalesce((select max(a.attempt_no) from exam_attempts a
                where a.exam_id = p_exam_id and a.student_id = auth.uid()), 0) + 1,
      least(now() + make_interval(mins => v_exam.duration_minutes), v_exam.end_at)
    )
    returning * into v_attempt;
  end if;

  return query select v_attempt.id, v_attempt.deadline_at, v_attempt.session_id;
end;
$$;

-- Jawaban tersimpan satu soal (null = belum dijawab)
create function public.attempt_answer_json(p_attempt_id uuid, p_question_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'selected_option_id', a.selected_option_id,
    'answer_text', a.answer_text,
    'answer_json', a.answer_json
  )
  from attempt_answers a
  where a.attempt_id = p_attempt_id and a.question_id = p_question_id;
$$;

create function public.get_exam_questions(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_attempt exam_attempts;
  v_exam exams;
  v_key text := p_attempt_id::text; -- benih acak per attempt
begin
  select * into v_attempt
  from exam_attempts
  where id = p_attempt_id and student_id = auth.uid() and not is_voided;

  if not found or not public.student_exam_open(v_attempt.exam_id) then
    raise exception 'Ujian tidak ditemukan' using errcode = '22023';
  end if;
  if v_attempt.status = 'submitted' then
    raise exception 'Ujian sudah dikumpulkan' using errcode = '22023';
  end if;
  if v_attempt.deadline_at <= now() then
    raise exception 'Waktu ujian sudah habis' using errcode = '22023';
  end if;

  select * into v_exam from exams where id = v_attempt.exam_id;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'exam_id', v_exam.id,
    'title', v_exam.title,
    'deadline_at', v_attempt.deadline_at,
    'require_fullscreen', v_exam.require_fullscreen,
    'max_tab_switches', v_exam.max_tab_switches,
    'tab_switch_count', v_attempt.tab_switch_count,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'type', q.type,
          'content', q.content,
          'image_path', q.image_path,
          'points', coalesce(eq.points, q.points),
          -- PG & B/S; B/S tidak diacak (Benar selalu di atas)
          'options', (
            select coalesce(jsonb_agg(
              jsonb_build_object('id', o.id, 'content', o.content, 'image_path', o.image_path)
              order by case when v_exam.shuffle_options and q.type = 'multiple_choice'
                then md5(v_key || o.id::text) else o.label::text end
            ), '[]')
            from question_options o where o.question_id = q.id
          ),
          -- Menjodohkan: kiri & kanan dipisah, kanan diacak per attempt → urutan tidak membocorkan pasangan.
          -- Jawaban murid: answer_json {"<id kiri>": "<key kanan>"}
          'lefts', (
            select coalesce(jsonb_agg(jsonb_build_object('id', pr.id, 'text', pr.left_text)
              order by pr.position), '[]')
            from question_pairs pr where pr.question_id = q.id
          ),
          'rights', (
            select coalesce(jsonb_agg(jsonb_build_object('key', pr.right_key, 'text', pr.right_text)
              order by md5(v_key || pr.right_key::text)), '[]')
            from question_pairs pr where pr.question_id = q.id
          ),
          -- Multi essay
          'subs', (
            select coalesce(jsonb_agg(
              jsonb_build_object('id', s.id, 'content', s.content, 'points', s.points,
                'answer', public.attempt_answer_json(p_attempt_id, s.id))
              order by s.position), '[]')
            from questions s where s.parent_id = q.id
          ),
          'answer', public.attempt_answer_json(p_attempt_id, q.id)
        )
        order by case when v_exam.shuffle_questions then md5(v_key || q.id::text) end, eq.order_no
      )
      from exam_questions eq
      join questions q on q.id = eq.question_id
      where eq.exam_id = v_exam.id
    ), '[]')
  );
end;
$$;

-- Gambar soal untuk murid: signed URL hanya untuk folder soal di ujian yang sedang ia kerjakan
-- (melengkapi question_images_select F2.8, DEC-030).
create function public.can_view_exam_image(p_object text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from exam_attempts a
    join exam_questions eq on eq.exam_id = a.exam_id
    where a.student_id = auth.uid()
      and not a.is_voided
      and a.status = 'in_progress'
      and a.deadline_at > now()
      and eq.tenant_id::text = (storage.foldername(p_object))[1]
      and eq.question_id::text = (storage.foldername(p_object))[2]
      and public.student_exam_open(a.exam_id)
  );
$$;

create policy question_images_select_student on storage.objects
  for select to authenticated
  using (
    bucket_id = 'question-images'
    and (select public.my_role()) = 'student'
    and public.can_view_exam_image(name)
  );

revoke execute on function
  public.student_exam_open(uuid),
  public.start_attempt(uuid, text),
  public.attempt_answer_json(uuid, uuid),
  public.get_exam_questions(uuid),
  public.can_view_exam_image(text)
from public, anon;
grant execute on function
  public.start_attempt(uuid, text),
  public.get_exam_questions(uuid),
  public.can_view_exam_image(text)
to authenticated;
