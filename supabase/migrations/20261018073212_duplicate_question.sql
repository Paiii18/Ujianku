-- F2.12 — duplicate_question: salin soal (milik sendiri atau guru lain di sekolah yang sama) menjadi
-- soal baru milik guru yang memanggil, beserta opsi, pasangan, dan sub-soal multi essay.
-- SECURITY INVOKER: membaca sumber & menulis salinan tetap lewat RLS F2.7 (hanya guru yang bisa menulis).
-- p_new_id dibuat browser lebih dulu: browser menyalin file gambar ke {tenant}/{p_new_id}/ (Storage
-- copy), lalu RPC ini menulis path gambar yang sudah diarahkan ke folder baru. Dengan begitu salinan
-- tetap bisa diubah di editor (save_question hanya menerima gambar dari folder soal itu sendiri).
-- Pasangan menjodohkan mendapat right_key baru (default acak), sub-soal mendapat id baru.

create function public.duplicate_question(p_source uuid, p_new_id uuid)
returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  v_src questions;
  v_from text;
  v_to text;
begin
  select * into v_src from questions where id = p_source and parent_id is null;
  if not found then
    raise exception 'Soal tidak ditemukan' using errcode = '22023';
  end if;
  v_from := v_src.tenant_id || '/' || p_source || '/';
  v_to := v_src.tenant_id || '/' || p_new_id || '/';

  insert into questions (id, subject_id, type, content, image_path, points, answer_key,
                         accepted_answers, keywords, explanation)
  values (p_new_id, v_src.subject_id, v_src.type, v_src.content,
          replace(v_src.image_path, v_from, v_to), v_src.points, v_src.answer_key,
          v_src.accepted_answers, v_src.keywords, v_src.explanation);

  insert into question_options (question_id, label, content, image_path, is_correct)
  select p_new_id, label, content, replace(image_path, v_from, v_to), is_correct
  from question_options where question_id = p_source;

  insert into question_pairs (question_id, position, left_text, right_text)
  select p_new_id, position, left_text, right_text
  from question_pairs where question_id = p_source;

  insert into questions (subject_id, parent_id, position, type, content, points, answer_key, keywords)
  select subject_id, p_new_id, position, type, content, points, answer_key, keywords
  from questions where parent_id = p_source;

  return p_new_id;
end;
$$;

revoke execute on function public.duplicate_question(uuid, uuid) from public, anon;
grant execute on function public.duplicate_question(uuid, uuid) to authenticated;
