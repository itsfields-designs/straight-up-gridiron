/**
 * Pulls the AP Top 25 poll and the college football schedule/scores from
 * ESPN's public college feed (the same poll published on ncaa.com's
 * Associated Press rankings page) and stores the games that involve at least
 * one ranked team.
 */

import { currentSeasonYear } from "@/lib/nfl-sync.server";

export const TOTAL_CFB_WEEKS = 15;

type EspnTeam = {
  id: string;
  location?: string;
  name?: string;
  nickname?: string;
  displayName?: string;
  shortDisplayName?: string;
  abbreviation?: string;
  logo?: string;
  logos?: { href: string }[];
};

type EspnCompetitor = {
  homeAway: "home" | "away";
  score?: string;
  curatedRank?: { current?: number };
  team: EspnTeam;
};

type EspnEvent = {
  id: string;
  date: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions: { competitors: EspnCompetitor[] }[];
};

type EspnRank = {
  current: number;
  previous?: number;
  trend?: string;
  points?: number;
  firstPlaceVotes?: number;
  recordSummary?: string;
  team: EspnTeam;
};

export type CfbSyncResult = {
  season: number;
  weeks: number[];
  games: number;
  ranked: number;
};

const BASE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const HEADERS = {
  accept: "application/json",
  "user-agent": "Mozilla/5.0 (compatible; GridironGods/1.0)",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    if (attempt < 3) {
      await sleep(500 * (attempt + 1));
      return getJson<T>(url, attempt + 1);
    }
    throw new Error(`College feed returned ${res.status}`);
  }
  return (await res.json()) as T;
}

function teamLabel(t: EspnTeam): string {
  return t.shortDisplayName || t.location || t.displayName || t.abbreviation || "TBD";
}

function teamLogo(t: EspnTeam): string | null {
  return t.logo || t.logos?.[0]?.href || null;
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

/** The week ESPN is currently showing on the college scoreboard. */
export async function currentCfbWeek(): Promise<number> {
  const json = await getJson<{ week?: { number?: number } }>(
    `${BASE}/scoreboard?groups=80&limit=1`,
  );
  const n = json.week?.number ?? 1;
  return Math.min(Math.max(n, 1), TOTAL_CFB_WEEKS);
}

async function syncRankings(): Promise<Map<string, EspnRank>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const json = await getJson<{ rankings?: { type?: string; name?: string; ranks?: EspnRank[] }[] }>(
    `${BASE}/rankings`,
  );
  const poll =
    json.rankings?.find((r) => r.type === "ap") ??
    json.rankings?.find((r) => (r.name ?? "").toLowerCase().includes("ap top 25"));
  const ranks = (poll?.ranks ?? []).filter((r) => r.current >= 1 && r.current <= 25);
  if (!ranks.length) return new Map();

  const rows = ranks.map((r) => ({
    rank: r.current,
    team: r.team.displayName || teamLabel(r.team),
    short_name: teamLabel(r.team),
    record: r.recordSummary ?? "",
    points: Math.round(r.points ?? 0),
    first_place_votes: r.firstPlaceVotes ?? 0,
    previous: r.previous ?? null,
    trend: r.trend ?? "",
    logo: teamLogo(r.team),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from("cfb_rankings").upsert(rows, { onConflict: "rank" });
  if (error) throw error;
  await supabaseAdmin.from("cfb_rankings").delete().gt("rank", rows.length);

  return new Map(ranks.map((r) => [r.team.id, r]));
}

function rankOf(c: EspnCompetitor | undefined, top25: Map<string, EspnRank>): number | null {
  if (!c) return null;
  const polled = top25.get(c.team.id)?.current;
  if (polled) return polled;
  const curated = c.curatedRank?.current;
  return curated && curated >= 1 && curated <= 25 ? curated : null;
}

/**
 * Syncs the AP poll plus the ranked-team slate for the given weeks
 * (default: the whole regular season).
 */
export async function syncCfb(weekNums?: number[]): Promise<CfbSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const season = currentSeasonYear();
  const top25 = await syncRankings();
  const weeks = weekNums?.length
    ? weekNums
    : Array.from({ length: TOTAL_CFB_WEEKS }, (_, i) => i + 1);

  let gameCount = 0;

  for (let i = 0; i < weeks.length; i += 3) {
    const batch = weeks.slice(i, i + 3);
    const fetched = await Promise.all(
      batch.map(async (week) => ({
        week,
        events:
          (
            await getJson<{ events?: EspnEvent[] }>(
              `${BASE}/scoreboard?dates=${season}&seasontype=2&week=${week}&groups=80&limit=300`,
            )
          ).events ?? [],
      })),
    );

    for (const { week, events } of fetched) {
      const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
      const rows = sorted
        .map((event) => {
          const competitors = event.competitions[0]?.competitors ?? [];
          const home = competitors.find((c) => c.homeAway === "home");
          const away = competitors.find((c) => c.homeAway === "away");
          const homeRank = rankOf(home, top25);
          const awayRank = rankOf(away, top25);
          if (homeRank == null && awayRank == null) return null;
          const completed = event.status?.type?.completed === true;
          const toScore = (c?: EspnCompetitor) =>
            completed && c?.score != null && c.score !== "" ? Number(c.score) : null;
          return {
            id: event.id,
            week_num: week,
            away: away ? teamLabel(away.team) : "TBD",
            home: home ? teamLabel(home.team) : "TBD",
            away_rank: awayRank,
            home_rank: homeRank,
            away_logo: away ? teamLogo(away.team) : null,
            home_logo: home ? teamLogo(home.team) : null,
            slot: formatSlot(event.date),
            sort_order: 0,
            kickoff: event.date,
            state: event.status?.type?.state ?? "pre",
            away_score: toScore(away),
            home_score: toScore(home),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .map((r, index) => ({ ...r, sort_order: index + 1 }));

      if (!rows.length) continue;

      const { error: upsertError } = await supabaseAdmin
        .from("cfb_games")
        .upsert(rows, { onConflict: "id" });
      if (upsertError) throw upsertError;
      gameCount += rows.length;

      const keep = rows.map((r) => `"${r.id}"`).join(",");
      const { error: deleteError } = await supabaseAdmin
        .from("cfb_games")
        .delete()
        .eq("week_num", week)
        .not("id", "in", `(${keep})`);
      if (deleteError) throw deleteError;

      const firstKickoff = rows[0]?.kickoff;
      const lastGameId = [...rows].sort((a, b) => {
        const ta = a.kickoff ? new Date(a.kickoff).getTime() : 0;
        const tb = b.kickoff ? new Date(b.kickoff).getTime() : 0;
        return ta - tb || a.sort_order - b.sort_order;
      })[rows.length - 1]?.id;
      const { error: weekError } = await supabaseAdmin.from("cfb_weeks").upsert(
        {
          week_num: week,
          label: `Week ${week}`,
          locked: firstKickoff ? new Date(firstKickoff).getTime() <= Date.now() : false,
          tiebreaker_game_id: lastGameId ?? null,
        },
        { onConflict: "week_num" },
      );
      if (weekError) throw weekError;
    }
  }

  const { error: rpcError } = await supabaseAdmin.rpc("recompute_cfb_standings");
  if (rpcError) throw rpcError;

  return { season, weeks, games: gameCount, ranked: top25.size };
}
