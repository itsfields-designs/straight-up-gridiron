ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS chat_locked boolean NOT NULL DEFAULT false;

CREATE TABLE public.league_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 2000),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX league_messages_league_created_idx ON public.league_messages (league_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_messages TO authenticated;
GRANT ALL ON public.league_messages TO service_role;

ALTER TABLE public.league_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select_league ON public.league_messages
  FOR SELECT TO authenticated
  USING (private.is_league_member(league_id, auth.uid()));

CREATE POLICY messages_insert_member ON public.league_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.is_league_member(league_id, auth.uid())
    AND (
      private.is_league_owner(league_id, auth.uid())
      OR NOT EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.chat_locked)
    )
  );

CREATE POLICY messages_update_owner ON public.league_messages
  FOR UPDATE TO authenticated
  USING (private.is_league_owner(league_id, auth.uid()))
  WITH CHECK (private.is_league_owner(league_id, auth.uid()));

CREATE POLICY messages_delete_own_or_owner ON public.league_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR private.is_league_owner(league_id, auth.uid()));

CREATE TRIGGER league_messages_updated_at BEFORE UPDATE ON public.league_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.league_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_messages;