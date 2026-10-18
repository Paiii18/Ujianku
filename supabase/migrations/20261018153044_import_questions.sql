-- F2.14 — Import soal dari Excel + ZIP gambar.
-- API Route mem-parse & memvalidasi file (src/lib/questionImport.ts), mengunggah gambar ZIP ke
-- question-images/{tenant}/{id soal}/..., lalu memanggil fungsi ini. Semua soal disimpan lewat
-- save_question (validasi yang sama dengan editor) dalam SATU transaksi: satu soal gagal = tidak ada
-- yang tersimpan. SECURITY INVOKER: RLS questions tetap berlaku (guru menulis soalnya sendiri).
-- Riwayat import_jobs dicatat API Route di luar transaksi ini, agar status gagal tidak ikut di-rollback.
--
-- p_questions: [{ "row": 2, "id": uuid, "subject_id": uuid, "type": "...", "content": "...",
--                 "image_path": null | "...", "points": 2, "explanation": "...",
--                 "options": [...], "answers": [...], "pairs": [...], "answer_key": "...",
--                 "keywords": [...], "subs": [...] }]   (bentuk options/pairs/subs = save_question)

create function public.import_questions(p_questions jsonb)
returns integer
language plpgsql security invoker
set search_path = public
as $$
declare
  q jsonb;
  n integer := 0;
begin
  if my_role() is distinct from 'teacher' or not tenant_is_active() then
    raise exception 'Hanya guru yang bisa mengimport soal' using errcode = '42501';
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array'
     or jsonb_array_length(p_questions) not between 1 and 500 then
    raise exception 'Import berisi 1–500 soal' using errcode = '22023';
  end if;

  for q in select value from jsonb_array_elements(p_questions) loop
    begin
      perform save_question(
        (q ->> 'id')::uuid,
        (q ->> 'subject_id')::uuid,
        (q ->> 'type')::question_type,
        q ->> 'content',
        q ->> 'image_path',
        (q ->> 'points')::numeric,
        q ->> 'explanation',
        coalesce(q -> 'options', '[]'),
        array(select jsonb_array_elements_text(coalesce(q -> 'answers', '[]'))),
        coalesce(q -> 'pairs', '[]'),
        q ->> 'answer_key',
        array(select jsonb_array_elements_text(coalesce(q -> 'keywords', '[]'))),
        coalesce(q -> 'subs', '[]')
      );
    exception when others then
      -- Sebutkan baris Excel-nya; errcode asli dipertahankan untuk API Route
      raise exception 'Baris %: %', q ->> 'row', sqlerrm using errcode = sqlstate;
    end;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.import_questions(jsonb) from public, anon;
grant execute on function public.import_questions(jsonb) to authenticated;
