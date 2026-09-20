import { createServerFn } from "@tanstack/react-start";

export type LiveScoreTeam = {
  name: string;
  short: string;
  logo: string | null;
};

export type LiveScoreGame = {
  id: string;
  league: string;
  kickoff: string | null;
  status: "live" | "scheduled" | "finished" | "other";
  statusLabel: string;
  broadcast: string | null;
  home: LiveScoreTeam;
  away: LiveScoreTeam;
  homeScore: number | null;
  awayScore: number | null;
  period: number | null;
};

type RawSide = { name?: string; short_name?: string; logo_url?: string | null };
type RawGame = {
  id?: string;
  league?: string;
  kickoff_utc?: string;
  status?: string;
  broadcast?: string | null;
  home?: RawSide;
  away?: RawSide;
  score?: { home?: number | null; away?: number | null } | null;
  linescore?: { home?: number[]; away?: number[] } | null;
};

function side(raw: RawSide | undefined): LiveScoreTeam {
  return {
    name: raw?.name ?? "TBD",
    short: raw?.short_name ?? (raw?.name ?? "TBD").slice(0, 3).toUpperCase(),
    logo: raw?.logo_url ?? null,
  };
}

function normalizeStatus(status: string | undefined): LiveScoreGame["status"] {
  if (status === "live" || status === "in_progress") return "live";
  if (status === "scheduled") return "scheduled";
  if (status === "finished" || status === "final") return "finished";
  return "other";
}

/**
 * Live NFL scores straight from the Big Ball Sports feed. Read-only and
 * public — there is nothing user-specific here, just the scoreboard.
 */
export const fetchLiveScores = createServerFn({ method: "GET" })
  .inputValidator((input: { league?: string; limit?: number } | undefined) => ({
    league: input?.league === "college-football" ? "college-football" : "nfl",
    limit: Math.min(Math.max(Math.trunc(input?.limit ?? 16), 1), 50),
  }))
  .handler(async ({ data }): Promise<{ games: LiveScoreGame[]; updatedAt: string }> => {
    const apiKey = process.env["BIGBALL_API_KEY"];
    if (!apiKey) throw new Error("Live scores are not configured yet.");

    const { BigBallSportsClient } = await import("@bigballsdata/sdk");
    const client = new BigBallSportsClient(apiKey);

    const response = await client.matches.list({
      sport: "american_football",
      league: data.league,
      limit: data.limit,
    });

    const raw = (response?.data ?? []) as unknown as RawGame[];
    const games: LiveScoreGame[] = raw
      .filter((g) => Boolean(g?.id))
      .map((g) => {
        const status = normalizeStatus(g.status);
        const periods = g.linescore?.home?.length ?? 0;
        return {
          id: String(g.id),
          league: g.league ?? data.league.toUpperCase(),
          kickoff: g.kickoff_utc ?? null,
          status,
          statusLabel:
            status === "live"
              ? periods
                ? `Q${periods}`
                : "Live"
              : status === "finished"
                ? "Final"
                : "Scheduled",
          broadcast: g.broadcast ?? null,
          home: side(g.home),
          away: side(g.away),
          homeScore: g.score?.home ?? null,
          awayScore: g.score?.away ?? null,
          period: periods || null,
        };
      })
      .sort((a, b) => {
        const rank = (s: LiveScoreGame["status"]) =>
          s === "live" ? 0 : s === "scheduled" ? 1 : 2;
        if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
        return (a.kickoff ?? "").localeCompare(b.kickoff ?? "");
      });

    return { games, updatedAt: new Date().toISOString() };
  });
