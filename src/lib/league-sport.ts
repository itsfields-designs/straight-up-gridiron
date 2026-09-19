import {
  TOTAL_CFB_WEEKS,
  fetchCfbCurrentWeek,
  fetchCfbWeek,
  type CfbGame,
} from "@/lib/cfb";
import {
  TOTAL_WEEKS,
  fetchCurrentWeek,
  fetchWeek,
  type Game,
  type League,
  type Week,
} from "@/lib/pool";

/** True for leagues that play the college (AP Top 25) schedule. */
export function isCollegeLeague(league: Pick<League, "sport">) {
  return league.sport === "ncaa";
}

export function totalWeeksFor(sport: string) {
  return sport === "ncaa" ? TOTAL_CFB_WEEKS : TOTAL_WEEKS;
}

function cfbToGame(g: CfbGame): Game {
  const name = (team: string, rank: number | null) => (rank ? `#${rank} ${team}` : team);
  return {
    id: g.id,
    week_num: g.week_num,
    away: name(g.away, g.away_rank),
    home: name(g.home, g.home_rank),
    away_rank: g.away_rank,
    home_rank: g.home_rank,
    away_logo: g.away_logo,
    home_logo: g.home_logo,
    slot: g.slot,
    sort_order: g.sort_order,
    away_score: g.away_score,
    home_score: g.home_score,
    kickoff: g.kickoff,
    state: g.state,
  };
}

/** The week's matchups for a league, from the NFL or the college schedule. */
export async function fetchLeagueWeek(
  sport: string,
  weekNum: number,
): Promise<{ week: Week | null; games: Game[] }> {
  if (sport !== "ncaa") return fetchWeek(weekNum);
  const { week, games } = await fetchCfbWeek(weekNum);
  return {
    week: week
      ? {
          week_num: week.week_num,
          label: week.label,
          tiebreaker_game_id: week.tiebreaker_game_id,
          locked: week.locked,
        }
      : null,
    games: games.map(cfbToGame),
  };
}

export async function fetchLeagueCurrentWeek(sport: string): Promise<number> {
  return sport === "ncaa" ? fetchCfbCurrentWeek() : fetchCurrentWeek();
}
