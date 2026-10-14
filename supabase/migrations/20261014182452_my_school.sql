-- F1.11 — Data sekolah milik user yang login, untuk halaman "Langganan berakhir" & dashboard
-- Admin Sekolah. SECURITY DEFINER agar tetap terbaca saat sekolah nonaktif (RLS tenants = 0 baris).
-- Hanya sekolah sendiri; Super Admin / tanpa profil → 0 baris.

create function public.my_school()
returns table (code text, name text, active_until timestamptz)
language sql stable security definer
set search_path = public
as $$
  select t.code, t.name, t.active_until
  from profiles p join tenants t on t.id = p.tenant_id
  where p.id = auth.uid();
$$;

revoke execute on function public.my_school() from public, anon;
grant execute on function public.my_school() to authenticated;
