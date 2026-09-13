/**
 * Pulls the real NFL regular-season schedule and live/final scores from ESPN's
 * public scoreboard feed and stores them in the database.
 */

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  team: { shortDisplayName?: string; displayName?: string; abbreviation?: string };
};

type EspnEvent = {
  id: string;
  date: string;
  status?: { type?: { state?: string; completed?: boolean; shortDetail?: string } };
  competitions: { competitors: EspnCompetitor[] }[];
};

export type SyncResult = { season: number; weeks: number[]; games: number };

export const TOTAL_WEEKS = 18;

export function currentSeasonYear(now = new Date()): number {
  // NFL season spans into the next calendar year; Jan/Feb still belong to it.
  return now.getUTCMonth() + 1 >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function formatSlot(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function teamName(c: EspnCompetitor): string {
  return c.team.shortDisplayName || c.team.displayName || c.team.abbreviation || "TBD";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWeek(season: number, week: number, attempt = 0): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    if (attempt < 3) {
      await sleep(500 * (attempt + 1));
      return fetchWeek(season, week, attempt + 1);
    }
    throw new Error(`NFL feed returned ${res.status} for week ${week}`);
  }
  const json = (await res.json()) as { events?: EspnEvent[] };
  return json.events ?? [];
}


/**
 * Syncs the given weeks (default: the whole 18-week regular season).
 * Scores are only stored once a game is final; in-progress games keep a live
 * score in `state` terms but stay ungraded.
 */
export async function syncNflSchedule(weekNums?: number[]): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const season = currentSeasonYear();
  const weeks = weekNums?.length
    ? weekNums
    : Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);

  // Fetched in small batches so the public feed doesn't rate-limit us.
  const results: { week: number; events: EspnEvent[] }[] = [];
  for (let i = 0; i < weeks.length; i += 3) {
    const batch = weeks.slice(i, i + 3);
    results.push(
      ...(await Promise.all(
        batch.map(async (w) => ({ week: w, events: await fetchWeek(season, w) })),
      )),
    );
  }


  let gameCount = 0;

  for (const { week, events } of results) {
    if (!events.length) continue;
    const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

    const rows = sorted.map((event, index) => {
      const competitors = event.competitions[0]?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      const state = event.status?.type?.state ?? "pre";
      const completed = event.status?.type?.completed === true;
      const toScore = (c?: EspnCompetitor) =>
        completed && c?.score != null && c.score !== "" ? Number(c.score) : null;
      return {
        id: event.id,
        week_num: week,
        away: away ? teamName(away) : "TBD",
        home: home ? teamName(home) : "TBD",
        slot: formatSlot(event.date),
        sort_order: index + 1,
        kickoff: event.date,
        state,
        away_score: toScore(away),
        home_score: toScore(home),
      };
    });

    const { error: upsertError } = await supabaseAdmin
      .from("games")
      .upsert(rows, { onConflict: "id" });
    if (upsertError) throw upsertError;
    gameCount += rows.length;

    // Drop any stale rows for this week that are no longer in the feed.
    const keep = rows.map((r) => r.id);
    const { error: deleteError } = await supabaseAdmin
      .from("games")
      .delete()
      .eq("week_num", week)
      .not("id", "in", `(${keep.map((id) => `"${id}"`).join(",")})`);
    if (deleteError) throw deleteError;

    const firstKickoff = sorted[0]?.date;
    const lastGameId = rows[rows.length - 1]?.id ?? null;
    const { error: weekError } = await supabaseAdmin.from("weeks").upsert(
      {
        week_num: week,
        label: `Week ${week}`,
        tiebreaker_game_id: lastGameId,
        locked: firstKickoff ? new Date(firstKickoff).getTime() <= Date.now() : false,
      },
      { onConflict: "week_num" },
    );
    if (weekError) throw weekError;
  }

  const { error: rpcError } = await supabaseAdmin.rpc("recompute_all_league_standings");
  if (rpcError) throw rpcError;

  return { season, weeks, games: gameCount };
}
