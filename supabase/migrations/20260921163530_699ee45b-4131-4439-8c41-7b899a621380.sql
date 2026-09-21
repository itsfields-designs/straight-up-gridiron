drop policy if exists payouts_insert_owner on public.payouts;
create policy payouts_insert_owner on public.payouts
for insert to authenticated
with check (
  private.is_league_owner(league_id, auth.uid())
  and created_by = auth.uid()
  and private.league_has_member(league_id, user_id)
);