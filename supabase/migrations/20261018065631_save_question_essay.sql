-- F2.11 — save_question menerima Essay & Multi essay.
-- Parameter baru → signature berubah, fungsi F2.10 di-drop lalu dibuat ulang (DEC-032).
-- p_answer_key : essay, jawaban acuan (wajib; dipakai similarity() di F3.11).
-- p_keywords   : essay, kata kunci opsional (maks 20); dirapikan: trim, kosong dibuang, kembar dibuang.
-- p_subs       : multi essay, sub-soal urut tampil:
--                [{"id": null | uuid, "content": "...", "answer_key": "...", "keywords": [...], "points": 2}]
--                Sub-soal = baris essay ber-parent_id (F2.7). id lama dikirim balik agar id stabil
--                (jawaban murid merujuk id sub-soal); id null = sub-soal baru. Sub-soal yang tidak
--                dikirim dihapus. Poin induk = jumlah poin sub-soal (dihitung di sini, bukan client).
-- Sub-soal tanpa gambar (ponytail: gambar cukup di teks pengantar induk).

drop function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb, text[], jsonb);

-- Rapikan kata kunci: trim, buang kosong & kembar (tanpa beda huruf besar/kecil), urutan tetap.
create function public.clean_keywords(p_keywords text[])
returns text[]
language sql immutable
set search_path = public
as $$
  select coalesce(array_agg(k order by n), '{}')
  from (
    select distinct on (lower(trim(k))) trim(k) as k, n
    from unnest(coalesce(p_keywords, '{}')) with ordinality as x(k, n)
    where trim(k) <> ''
    order by lower(trim(k)), n
  ) d;
$$;

-- Validasi isi essay (dipakai untuk soal essay & tiap sub-soal multi essay)
create function public.assert_essay(p_label text, p_content text, p_answer_key text, p_keywords text[])
returns void
language plpgsql immutable
set search_path = public
as $$
begin
  if length(trim(coalesce(p_content, ''))) not between 1 and 10000 then
    raise exception '%: teks soal wajib diisi (maks 10.000 karakter)', p_label using errcode = '22023';
  end if;
  if length(trim(coalesce(p_answer_key, ''))) not between 1 and 10000 then
    raise exception '%: jawaban acuan wajib diisi (maks 10.000 karakter)', p_label using errcode = '22023';
  end if;
  if cardinality(p_keywords) > 20 or exists (select 1 from unnest(p_keywords) k where length(k) > 50) then
    raise exception '%: maksimal 20 kata kunci, masing-masing 50 karakter', p_label using errcode = '22023';
  end if;
end;
$$;

create function public.save_question(
  p_id uuid,
  p_subject_id uuid,
  p_type public.question_type,
  p_content text,
  p_image_path text,
  p_points numeric,
  p_explanation text,
  p_options jsonb default '[]',
  p_answers text[] default '{}',
  p_pairs jsonb default '[]',
  p_answer_key text default null,
  p_keywords text[] default '{}',
  p_subs jsonb default '[]'
)
returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  v_choice boolean := p_type in ('multiple_choice', 'true_false');
  v_labels text[];
  v_correct integer;
  v_answers text[];
  v_pairs integer;
  v_keywords text[];
  v_sub_ids uuid[] := '{}';
  v_folder text := my_tenant() || '/' || p_id || '/';
begin
  if not v_choice then
    p_options := '[]';
  end if;
  if p_type <> 'multi_essay' then
    p_subs := '[]';
  end if;
  p_subs := coalesce(p_subs, '[]');

  -- PG & BS -------------------------------------------------------------------------
  if v_choice then
    select coalesce(array_agg(o ->> 'label' order by o ->> 'label'), '{}'),
           count(*) filter (where (o ->> 'is_correct')::boolean)
      into v_labels, v_correct
    from jsonb_array_elements(p_options) o;

    -- PG: 2–5 opsi berurutan A, B, C, ...; BS: tepat A (Benar) & B (Salah)
    if p_type = 'multiple_choice' and (
      cardinality(v_labels) not between 2 and 5
      or v_labels <> (array['A', 'B', 'C', 'D', 'E'])[1:cardinality(v_labels)]
    ) then
      raise exception 'Soal pilihan ganda harus punya 2–5 opsi (A–E)' using errcode = '22023';
    end if;
    if p_type = 'true_false' and v_labels <> array['A', 'B'] then
      raise exception 'Soal benar/salah harus punya opsi A dan B' using errcode = '22023';
    end if;
    if v_correct <> 1 then
      raise exception 'Harus ada tepat satu kunci jawaban' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_options) o
      where trim(coalesce(o ->> 'content', '')) = '' and nullif(o ->> 'image_path', '') is null
    ) then
      raise exception 'Setiap opsi harus berisi teks atau gambar' using errcode = '22023';
    end if;
  end if;

  -- Isian ---------------------------------------------------------------------------
  if p_type = 'short_answer' then
    select coalesce(array_agg(trim(a) order by n), '{}') into v_answers
    from unnest(coalesce(p_answers, '{}')) with ordinality as x(a, n);

    if cardinality(v_answers) not between 1 and 10 then
      raise exception 'Isian harus punya 1–10 jawaban yang diterima' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(v_answers) a where length(a) not between 1 and 200) then
      raise exception 'Setiap jawaban diterima harus berisi 1–200 karakter' using errcode = '22023';
    end if;
    if (select count(distinct lower(regexp_replace(a, '\s+', ' ', 'g'))) from unnest(v_answers) a)
       <> cardinality(v_answers) then
      raise exception 'Ada jawaban diterima yang sama' using errcode = '22023';
    end if;
  end if;

  -- Menjodohkan ---------------------------------------------------------------------
  if p_type = 'matching' then
    p_pairs := coalesce(p_pairs, '[]');
    v_pairs := jsonb_array_length(p_pairs);
    if v_pairs not between 2 and 10 then
      raise exception 'Soal menjodohkan harus punya 2–10 pasangan' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_pairs) p
      where length(trim(coalesce(p ->> 'left', ''))) not between 1 and 500
         or length(trim(coalesce(p ->> 'right', ''))) not between 1 and 500
    ) then
      raise exception 'Setiap pasangan harus berisi teks kiri dan kanan (maks 500 karakter)'
        using errcode = '22023';
    end if;
    -- Teks kembar di satu sisi membuat jawaban murid ambigu
    if (select count(distinct lower(trim(p ->> 'left'))) from jsonb_array_elements(p_pairs) p) <> v_pairs
       or (select count(distinct lower(trim(p ->> 'right'))) from jsonb_array_elements(p_pairs) p) <> v_pairs then
      raise exception 'Teks di sisi kiri maupun kanan tidak boleh sama' using errcode = '22023';
    end if;
  end if;

  -- Essay ---------------------------------------------------------------------------
  if p_type = 'essay' then
    v_keywords := clean_keywords(p_keywords);
    perform assert_essay('Essay', p_content, p_answer_key, v_keywords);
  end if;

  -- Multi essay: 2–20 sub-soal, poin induk = jumlah poin sub-soal --------------------
  if p_type = 'multi_essay' then
    if jsonb_array_length(p_subs) not between 2 and 20 then
      raise exception 'Multi essay harus punya 2–20 sub-soal' using errcode = '22023';
    end if;
    perform assert_essay('Sub-soal ' || n, s ->> 'content', s ->> 'answer_key',
                         clean_keywords(array(select jsonb_array_elements_text(coalesce(s -> 'keywords', '[]')))))
    from jsonb_array_elements(p_subs) with ordinality as x(s, n);
    if exists (
      select 1 from jsonb_array_elements(p_subs) s
      where coalesce((s ->> 'points')::numeric, 0) not between 0.01 and 1000
    ) then
      raise exception 'Poin sub-soal harus lebih dari 0 (maks 1.000)' using errcode = '22023';
    end if;
    -- id sub-soal lama harus milik induk ini (bukan soal lain milik guru yang sama)
    select coalesce(array_agg((s ->> 'id')::uuid), '{}') into v_sub_ids
    from jsonb_array_elements(p_subs) s
    where nullif(s ->> 'id', '') is not null;
    if exists (select 1 from questions q where q.id = any (v_sub_ids) and q.parent_id is distinct from p_id)
       or cardinality(v_sub_ids) <> (select count(distinct x) from unnest(v_sub_ids) x) then
      raise exception 'Sub-soal tidak valid' using errcode = '22023';
    end if;
    select sum((s ->> 'points')::numeric) into p_points from jsonb_array_elements(p_subs) s;
  end if;

  -- Gambar hanya dari folder soal ini (bucket question-images, F2.8)
  if exists (
    select 1
    from (
      select nullif(p_image_path, '') as path
      union all
      select nullif(o ->> 'image_path', '') from jsonb_array_elements(p_options) o
    ) x
    where x.path is not null and left(x.path, length(v_folder)) <> v_folder
  ) then
    raise exception 'Path gambar tidak valid' using errcode = '22023';
  end if;

  insert into questions (id, subject_id, type, content, image_path, points, explanation,
                         accepted_answers, answer_key, keywords)
  values (p_id, p_subject_id, p_type, trim(p_content), nullif(p_image_path, ''), p_points,
          nullif(trim(coalesce(p_explanation, '')), ''), v_answers,
          case when p_type = 'essay' then trim(p_answer_key) end, v_keywords)
  on conflict (id) do update set
    subject_id = excluded.subject_id,
    type = excluded.type,
    content = excluded.content,
    image_path = excluded.image_path,
    points = excluded.points,
    explanation = excluded.explanation,
    accepted_answers = excluded.accepted_answers,
    answer_key = excluded.answer_key,
    keywords = excluded.keywords;

  -- Opsi (kosong untuk tipe selain PG/BS → semua opsi lama terhapus)
  delete from question_options where question_id = p_id and label <> all (coalesce(v_labels, '{}'));
  insert into question_options (question_id, label, content, image_path, is_correct)
  select p_id, o ->> 'label', trim(coalesce(o ->> 'content', '')),
         nullif(o ->> 'image_path', ''), (o ->> 'is_correct')::boolean
  from jsonb_array_elements(p_options) o
  on conflict (question_id, label) do update set
    content = excluded.content,
    image_path = excluded.image_path,
    is_correct = excluded.is_correct;

  -- Pasangan (position 0, 1, 2, ...; kosong untuk tipe selain menjodohkan)
  if p_type <> 'matching' then
    p_pairs := '[]';
  end if;
  delete from question_pairs where question_id = p_id and position >= jsonb_array_length(p_pairs);
  update question_pairs qp set
    left_text = trim(p.value ->> 'left'),
    right_text = trim(p.value ->> 'right')
  from jsonb_array_elements(p_pairs) with ordinality p(value, n)
  where qp.question_id = p_id and qp.position = p.n - 1;
  insert into question_pairs (question_id, position, left_text, right_text)
  select p_id, p.n - 1, trim(p.value ->> 'left'), trim(p.value ->> 'right')
  from jsonb_array_elements(p_pairs) with ordinality p(value, n)
  where not exists (
    select 1 from question_pairs qp where qp.question_id = p_id and qp.position = p.n - 1
  );

  -- Sub-soal (kosong untuk tipe selain multi essay → semua sub-soal lama terhapus)
  delete from questions where parent_id = p_id and id <> all (v_sub_ids);
  insert into questions (id, subject_id, parent_id, position, type, content, points, answer_key, keywords)
  select coalesce(nullif(s ->> 'id', '')::uuid, gen_random_uuid()), p_subject_id, p_id, n - 1, 'essay',
         trim(s ->> 'content'), (s ->> 'points')::numeric, trim(s ->> 'answer_key'),
         clean_keywords(array(select jsonb_array_elements_text(coalesce(s -> 'keywords', '[]'))))
  from jsonb_array_elements(p_subs) with ordinality as x(s, n)
  on conflict (id) do update set
    subject_id = excluded.subject_id,
    position = excluded.position,
    content = excluded.content,
    points = excluded.points,
    answer_key = excluded.answer_key,
    keywords = excluded.keywords;

  return p_id;
end;
$$;

revoke execute on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb, text[], jsonb, text, text[], jsonb)
  from public, anon;
grant execute on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb, text[], jsonb, text, text[], jsonb)
  to authenticated;

-- Helper dipanggil save_question (SECURITY INVOKER) → butuh hak authenticated, tidak untuk anon
revoke execute on function public.clean_keywords(text[]) from public, anon;
revoke execute on function public.assert_essay(text, text, text, text[]) from public, anon;
grant execute on function public.clean_keywords(text[]) to authenticated;
grant execute on function public.assert_essay(text, text, text, text[]) to authenticated;
