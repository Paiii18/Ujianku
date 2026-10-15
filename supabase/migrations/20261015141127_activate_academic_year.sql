-- F2.2 — "Jadikan aktif" tahun ajaran.
-- Dua UPDATE dalam satu transaksi: nonaktifkan yang lama dulu, baru aktifkan yang dipilih,
-- karena partial unique index menolak dua tahun ajaran aktif sekaligus.
-- SECURITY INVOKER (default): berjalan dengan hak user, jadi RLS academic_years_write
-- yang menentukan siapa boleh (Admin Sekolah tenant sendiri / Super Admin).

create function public.activate_academic_year(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from academic_years where id = p_id;
  if not found then
    raise exception 'Tahun ajaran tidak ditemukan' using errcode = 'P0002';
  end if;

  -- Kunci semua tahun ajaran sekolah ini: dua aktivasi bersamaan diproses bergantian,
  -- bukan saling tabrak di unique index.
  perform 1 from academic_years where tenant_id = v_tenant for update;

  update academic_years set is_active = false
  where tenant_id = v_tenant and is_active and id <> p_id;

  update academic_years set is_active = true where id = p_id;
  -- RLS bisa membuat UPDATE tidak mengenai baris (guru: baca saja) tanpa error
  if not found then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.activate_academic_year(uuid) from public, anon;
grant execute on function public.activate_academic_year(uuid) to authenticated;
