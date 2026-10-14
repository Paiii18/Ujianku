-- F1.9 — Pembayaran langganan: catat (pending) → tandai lunas lewat RPC mark_payment_paid().
-- Status 'paid' HANYA bisa diset oleh RPC, karena lunas wajib sekaligus memperpanjang masa aktif.
-- Dari browser Super Admin hanya boleh: insert 'pending', ubah 'pending' → 'cancelled'.
-- Audit otomatis lewat trigger write_audit_log (F1.8).

drop policy subscriptions_insert_super_admin on public.subscriptions;
drop policy subscriptions_update_super_admin on public.subscriptions;

create policy subscriptions_insert_super_admin on public.subscriptions
  for insert to authenticated
  with check ((select public.is_super_admin()) and status = 'pending');

-- Pembayaran lunas tidak bisa diubah/dibatalkan dari aplikasi (masa aktif sudah bertambah).
create policy subscriptions_update_super_admin on public.subscriptions
  for update to authenticated
  using ((select public.is_super_admin()) and status = 'pending')
  with check ((select public.is_super_admin()) and status in ('pending', 'cancelled'));

-- mark_payment_paid -----------------------------------------------------------
-- Masa aktif +1 bulan dari active_until lama bila masih berjalan, atau dari sekarang bila sudah
-- lewat / belum pernah aktif. Tenant langsung aktif. Mengembalikan active_until baru.
-- ponytail: selalu 1 bulan per pembayaran; paket 6/12 bulan menunggu Q-001 (F5.3).

create function public.mark_payment_paid(p_subscription_id uuid)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status payment_status;
  v_start timestamptz;
  v_end timestamptz;
begin
  if not is_super_admin() then
    raise exception 'Hanya Super Admin' using errcode = '42501';
  end if;

  -- FOR UPDATE: kunci baris agar dua klik "lunas" bersamaan tidak memperpanjang dua kali.
  select tenant_id, status into v_tenant_id, v_status
  from subscriptions where id = p_subscription_id for update;
  if not found then
    raise exception 'Pembayaran tidak ditemukan' using errcode = 'P0002';
  end if;
  if v_status <> 'pending' then
    raise exception 'Pembayaran sudah %', v_status using errcode = 'P0001';
  end if;

  select greatest(coalesce(active_until, now()), now()) into v_start
  from tenants where id = v_tenant_id for update;
  v_end := v_start + interval '1 month';

  update subscriptions set
    status = 'paid',
    paid_at = now(),
    period_start = (v_start at time zone 'Asia/Jakarta')::date,
    period_end = (v_end at time zone 'Asia/Jakarta')::date
  where id = p_subscription_id;

  update tenants set status = 'active', active_until = v_end where id = v_tenant_id;

  return v_end;
end;
$$;

revoke execute on function public.mark_payment_paid(uuid) from public, anon;
grant execute on function public.mark_payment_paid(uuid) to authenticated;
