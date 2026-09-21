
alter table public.cash_transactions
  add constraint cash_transactions_note_len_check check (char_length(note) <= 500);

drop policy if exists cash_insert_own on public.cash_transactions;
create policy cash_insert_own on public.cash_transactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.is_league_member(league_id, auth.uid())
    and kind in ('deposit','withdrawal')
    and amount > 0
    and amount <= 1000000
  );

drop policy if exists cash_update_own on public.cash_transactions;
create policy cash_update_own on public.cash_transactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and kind in ('deposit','withdrawal')
    and amount > 0
    and amount <= 1000000
  );

drop policy if exists messages_update_owner on public.league_messages;
drop policy if exists messages_update_author on public.league_messages;
drop policy if exists messages_pin_by_owner on public.league_messages;

create policy messages_update_author on public.league_messages
  for update to authenticated
  using (user_id = auth.uid() and private.is_league_member(league_id, auth.uid()))
  with check (user_id = auth.uid() and private.is_league_member(league_id, auth.uid()));

create policy messages_pin_by_owner on public.league_messages
  for update to authenticated
  using (private.is_league_owner(league_id, auth.uid()))
  with check (private.is_league_owner(league_id, auth.uid()));

create or replace function public.enforce_league_message_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.body is distinct from old.body and old.user_id <> auth.uid() then
    raise exception 'Only the author can edit a message body';
  end if;
  if new.user_id <> old.user_id or new.league_id <> old.league_id or new.created_at <> old.created_at then
    raise exception 'Message ownership cannot be changed';
  end if;
  if new.pinned is distinct from old.pinned
     and not private.is_league_owner(old.league_id, auth.uid()) then
    raise exception 'Only the league commissioner can pin messages';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists enforce_league_message_edit on public.league_messages;
create trigger enforce_league_message_edit
  before update on public.league_messages
  for each row execute function public.enforce_league_message_edit();
