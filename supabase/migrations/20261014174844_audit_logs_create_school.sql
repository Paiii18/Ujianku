-- F1.8 — audit_logs + RPC create_school.
-- Audit ditulis oleh trigger (bukan kode aplikasi), jadi setiap INSERT/UPDATE tabel fondasi
-- tercatat apa pun jalurnya: API Route, RPC, atau update langsung dari browser.

-- audit_logs ------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants (id),
  -- NULL = aksi sistem (pg_cron, seed, service_role)
  actor_id uuid references public.profiles (id),
  action text not null, -- '<tabel>.<insert|update>', misal 'tenants.update'
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_tenant_id_idx on public.audit_logs (tenant_id);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);

alter table public.audit_logs enable row level security;

-- Hanya trigger (SECURITY DEFINER) yang menulis; log tidak bisa diubah/dihapus user.
revoke insert, update, delete on public.audit_logs from anon, authenticated;

create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      tenant_id = (select public.my_tenant())
      and (select public.tenant_is_active())
      and (select public.my_role()) = 'school_admin'
    )
  );

-- Trigger audit generik -------------------------------------------------------

create function public.write_audit_log()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  row_json jsonb := to_jsonb(new);
begin
  if tg_op = 'UPDATE' and new is not distinct from old then
    return new;
  end if;

  insert into audit_logs (tenant_id, actor_id, action, record_id, old_value, new_value)
  values (
    -- tabel tenants: tenant = baris itu sendiri; tabel lain: kolom tenant_id
    case when tg_table_name = 'tenants' then new.id else (row_json ->> 'tenant_id')::uuid end,
    -- hanya isi actor bila user punya profil (FK); selain itu aksi sistem
    (select id from profiles where id = auth.uid()),
    tg_table_name || '.' || lower(tg_op),
    new.id,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    row_json
  );
  return new;
end;
$$;

revoke execute on function public.write_audit_log() from public, anon, authenticated;

create trigger tenants_audit after insert or update on public.tenants
  for each row execute function public.write_audit_log();
create trigger subscriptions_audit after insert or update on public.subscriptions
  for each row execute function public.write_audit_log();
create trigger profiles_audit after insert or update on public.profiles
  for each row execute function public.write_audit_log();

-- create_school ---------------------------------------------------------------
-- Dipanggil API Route POST /api/admin/schools SETELAH akun Auth admin dibuat.
-- SECURITY INVOKER: berjalan sebagai user pemanggil, jadi RLS (hanya Super Admin yang boleh
-- insert tenants/profiles) tetap menjadi penjaga. Kedua insert satu transaksi:
-- kode duplikat (23505) = tidak ada yang tersimpan.

create function public.create_school(
  p_code text,
  p_name text,
  p_admin_id uuid,
  p_admin_name text
)
returns uuid
language sql security invoker
set search_path = public
as $$
  with t as (
    insert into tenants (code, name) values (p_code, p_name) returning id
  ), p as (
    insert into profiles (id, tenant_id, role, full_name)
    select p_admin_id, t.id, 'school_admin', p_admin_name from t
    returning tenant_id
  )
  select tenant_id from p;
$$;

revoke execute on function public.create_school(text, text, uuid, text) from public, anon;
grant execute on function public.create_school(text, text, uuid, text) to authenticated;
