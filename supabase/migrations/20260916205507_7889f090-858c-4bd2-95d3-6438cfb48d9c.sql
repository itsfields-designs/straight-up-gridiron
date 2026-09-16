create or replace function private.league_has_member(_league_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.league_members where league_id = _league_id and user_id = _user_id);
$$;

grant execute on function private.league_has_member(uuid, uuid) to authenticated;

drop policy if exists entry_payments_insert_owner on public.entry_payments;
create policy entry_payments_insert_owner on public.entry_payments
for insert to authenticated
with check (
  private.is_league_owner(league_id, auth.uid())
  and marked_by = auth.uid()
  and private.league_has_member(league_id, user_id)
);