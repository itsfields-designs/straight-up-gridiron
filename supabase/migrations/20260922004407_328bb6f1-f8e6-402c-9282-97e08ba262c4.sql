-- Fix 1: cash_transactions UPDATE policy — re-validate league membership and freeze league_id
drop policy if exists cash_update_own on public.cash_transactions;
create policy cash_update_own on public.cash_transactions
for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and private.is_league_member(league_id, auth.uid())
  and kind = any (array['deposit'::text, 'withdrawal'::text])
  and amount > 0 and amount <= 1000000
  and league_id = (select ct.league_id from public.cash_transactions ct where ct.id = cash_transactions.id)
);

-- Fix 2: duels SELECT — open duels with no opponent visible to any authenticated user
drop policy if exists duels_select on public.duels;
create policy duels_select on public.duels
for select to authenticated
using (
  challenger_id = auth.uid()
  or opponent_id = auth.uid()
  or (status = 'open' and opponent_id is null)
);