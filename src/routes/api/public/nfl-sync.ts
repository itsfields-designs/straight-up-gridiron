import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled live-score refresh. Called every couple of minutes by the database
 * scheduler so scores and standings stay current even when nobody has the app
 * open. It only reads the public NFL feed and writes the resulting scores, so
 * there is no user data to protect here; work is bounded to the live week.
 */
async function runSync(full: boolean) {
  const { syncNflSchedule, currentLiveWeeks } = await import("@/lib/nfl-sync.server");
  const weeks = full ? undefined : await currentLiveWeeks();
  return syncNflSchedule(weeks);
}

export const Route = createFileRoute("/api/public/nfl-sync")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        try {
          const result = await runSync(url.searchParams.get("full") === "1");
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "sync failed" },
            { status: 502 },
          );
        }
      },
      GET: async () => {
        try {
          const result = await runSync(false);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "sync failed" },
            { status: 502 },
          );
        }
      },
    },
  },
});
