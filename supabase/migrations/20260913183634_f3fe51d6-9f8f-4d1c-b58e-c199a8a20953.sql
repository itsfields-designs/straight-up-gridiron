-- lovable-cron-fallback-reviewed: 720 runs/day; live NFL scores must land within ~2 minutes and the ESPN feed offers no webhook, so short-interval polling is the only way to keep standings current while games are in progress.
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.league_standings REPLICA IDENTITY FULL;
ALTER TABLE public.weeks REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.games; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.league_standings; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.weeks; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('nfl-live-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nfl-live-sync');

SELECT cron.schedule(
  'nfl-live-sync',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--ca24528c-16f5-457b-93b0-2d706bd12e7e-dev.lovable.app/api/public/nfl-sync',
    headers := jsonb_build_object('content-type', 'application/json'),
    body := '{}'::jsonb
  );
  $cron$
);
