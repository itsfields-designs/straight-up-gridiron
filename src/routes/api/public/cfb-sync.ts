import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled college refresh. Pulls the AP Top 25 poll and scores for ranked
 * teams so rankings, games and the college leaderboard stay current without
 * anyone having the app open. Reads a public feed only.
 */
async function runSync(full: boolean) {
  const { syncCfb, currentCfbWeek } = await import("@/lib/cfb-sync.server");
  if (full) return syncCfb();
  const week = await currentCfbWeek();
  return syncCfb([week]);
}

export const Route = createFileRoute("/api/public/cfb-sync")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const result = await runSync(url.searchParams.get("full") === "1");
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("cfb-sync failed", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : JSON.stringify(err) },
            { status: 502 },
          );
        }
      },
      GET: async () => {
        try {
          const result = await runSync(false);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("cfb-sync failed", err);
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : JSON.stringify(err) },
            { status: 502 },
          );
        }
      },
    },
  },
});
