-- F1.6 — Status akses user yang login, dipanggil src/proxy.ts di setiap request halaman.
-- Satu RPC = satu round-trip (peran + akun aktif + sekolah aktif).
-- Tetap terbaca saat sekolah nonaktif (SECURITY DEFINER), agar proxy bisa mengarahkan ke
-- /subscription-expired. Tanpa profil → 0 baris.

create function public.my_access()
returns table (role public.user_role, is_active boolean, tenant_active boolean)
language sql stable security definer
set search_path = public
as $$
  select p.role, p.is_active, public.tenant_is_active()
  from profiles p
  where p.id = auth.uid();
$$;

revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;
