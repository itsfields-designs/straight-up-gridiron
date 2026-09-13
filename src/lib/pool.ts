import { supabase } from "@/integrations/supabase/client";

export type Side = "home" | "away";

export type Game = {
  id: string;
  week_num: number;
  away: string;
  home: string;
  slot: string;
  sort_order: number;
  away_score: number | null;
  home_score: number | null;
  kickoff: string | null;
  state: string;
};


export type Week = {
  week_num: number;
  label: string;
  tiebreaker_game_id: string | null;
  locked: boolean;
};

export type PickEntry = {
  user_id: string;
  week_num: number;
  picks: Record<string, Side>;
  tiebreaker: number | null;
};

export type League = {
  id: string;
  name: string;
  rules: string;
  code: string;
  owner_id: string;
  entry_fee: number;
  weekly_pot: number;
  season_pot: number;
  chat_locked: boolean;
};

export type Member = { user_id: string; username: string };

export const TOTAL_WEEKS = 18;

export function gradeGame(game: Game): Side | "tie" | null {
  if (game.home_score == null || game.away_score == null) return null;
  if (game.home_score === game.away_score) return "tie";
  return game.home_score > game.away_score ? "home" : "away";
}

export async function fetchMyLeagues(): Promise<League[]> {
  const { data: memberships, error: e1 } = await supabase
    .from("league_members")
    .select("league_id");
  if (e1) throw e1;
  const ids = (memberships ?? []).map((m) => m.league_id);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, rules, code, owner_id, entry_fee, weekly_pot, season_pot, chat_locked")
    .in("id", ids)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLeague(leagueId: string): Promise<League> {
  const { data, error } = await supabase
    .from("leagues")
    .select("id, name, rules, code, owner_id, entry_fee, weekly_pot, season_pot, chat_locked")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("League not found");
  return data;
}

export async function fetchMembers(leagueId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("league_members")
    .select("user_id, joined_at")
    .eq("league_id", leagueId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  const ids = (data ?? []).map((m) => m.user_id);
  if (!ids.length) return [];
  const { data: profiles, error: pe } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", ids);
  if (pe) throw pe;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  return ids.map((id) => ({ user_id: id, username: byId.get(id) ?? "Unknown player" }));
}

export async function fetchWeek(weekNum: number): Promise<{ week: Week | null; games: Game[] }> {
  const { data: week, error } = await supabase
    .from("weeks")
    .select("week_num, label, tiebreaker_game_id, locked")
    .eq("week_num", weekNum)
    .maybeSingle();
  if (error) throw error;
  if (!week) return { week: null, games: [] };
  const { data: games, error: ge } = await supabase
    .from("games")
    .select("id, week_num, away, home, slot, sort_order, away_score, home_score, kickoff, state")
    .eq("week_num", weekNum)
    .order("sort_order", { ascending: true });
  if (ge) throw ge;
  return { week, games: (games ?? []) as Game[] };
}

export async function fetchAllWeeks(): Promise<{ weeks: Week[]; games: Game[] }> {
  const [{ data: weeks, error: we }, { data: games, error: ge }] = await Promise.all([
    supabase.from("weeks").select("week_num, label, tiebreaker_game_id, locked").order("week_num"),
    supabase
      .from("games")
      .select("id, week_num, away, home, slot, sort_order, away_score, home_score, kickoff, state")
      .order("sort_order"),
  ]);
  if (we) throw we;
  if (ge) throw ge;
  return { weeks: (weeks ?? []) as Week[], games: (games ?? []) as Game[] };
}

export async function fetchPickEntries(leagueId: string, weekNum?: number): Promise<PickEntry[]> {
  let query = supabase
    .from("pick_entries")
    .select("user_id, week_num, picks, tiebreaker")
    .eq("league_id", leagueId);
  if (weekNum != null) query = query.eq("week_num", weekNum);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    user_id: row.user_id,
    week_num: row.week_num,
    picks: (row.picks ?? {}) as Record<string, Side>,
    tiebreaker: row.tiebreaker,
  }));
}

export async function savePicks(args: {
  leagueId: string;
  weekNum: number;
  userId: string;
  picks: Record<string, Side>;
  tiebreaker: number | null;
}) {
  const { error } = await supabase.from("pick_entries").upsert(
    {
      league_id: args.leagueId,
      week_num: args.weekNum,
      user_id: args.userId,
      picks: args.picks,
      tiebreaker: args.tiebreaker,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "league_id,week_num,user_id" },
  );
  if (error) throw error;
}

// ---- standings -------------------------------------------------------------
export type StandingRow = {
  userId: string;
  username: string;
  correct: number;
  missed: number;
  tbDiff: number | null;
  submitted: boolean;
};

function tiebreakerDiff(games: Game[], week: Week | undefined, entry: PickEntry | undefined) {
  if (!week?.tiebreaker_game_id || !entry || entry.tiebreaker == null) return null;
  const tbGame = games.find((g) => g.id === week.tiebreaker_game_id);
  if (!tbGame || tbGame.home_score == null || tbGame.away_score == null) return null;
  return Math.abs(entry.tiebreaker - (tbGame.home_score + tbGame.away_score));
}

export function computeStandings(
  members: Member[],
  weeks: Week[],
  games: Game[],
  entries: PickEntry[],
): StandingRow[] {
  const rows = members.map((member) => {
    const mine = entries.filter((e) => e.user_id === member.user_id);
    let correct = 0;
    let missed = 0;
    let tbTotal = 0;
    let tbCount = 0;
    for (const week of weeks) {
      const entry = mine.find((e) => e.week_num === week.week_num);
      const weekGames = games.filter((g) => g.week_num === week.week_num);
      for (const game of weekGames) {
        const winner = gradeGame(game);
        if (!winner || winner === "tie") continue;
        if (entry?.picks?.[game.id] === winner) correct++;
        else missed++;
      }
      const diff = tiebreakerDiff(weekGames, week, entry);
      if (diff != null) {
        tbTotal += diff;
        tbCount++;
      }
    }
    return {
      userId: member.user_id,
      username: member.username,
      correct,
      missed,
      tbDiff: tbCount ? tbTotal : null,
      submitted: mine.length > 0,
    };
  });

  rows.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.tbDiff != null && b.tbDiff != null) return a.tbDiff - b.tbDiff;
    if (a.tbDiff != null) return -1;
    if (b.tbDiff != null) return 1;
    return a.username.localeCompare(b.username);
  });
  return rows;
}

// ---- stored standings ------------------------------------------------------
export type StoredStanding = {
  userId: string;
  username: string;
  rank: number;
  correct: number;
  missed: number;
  tbDiff: number | null;
  submitted: boolean;
  updatedAt: string;
};

/** Reads pre-calculated standings. weekNum 0 = season total. */
export async function fetchStandings(
  leagueId: string,
  weekNum: number,
): Promise<StoredStanding[]> {
  const { data, error } = await supabase
    .from("league_standings")
    .select("user_id, rank, correct, missed, tb_diff, submitted, updated_at")
    .eq("league_id", leagueId)
    .eq("week_num", weekNum)
    .order("rank", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: profiles, error: pe } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", rows.map((r) => r.user_id));
  if (pe) throw pe;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  return rows.map((r) => ({
    userId: r.user_id,
    username: byId.get(r.user_id) ?? "Unknown player",
    rank: r.rank,
    correct: r.correct,
    missed: r.missed,
    tbDiff: r.tb_diff,
    submitted: r.submitted,
    updatedAt: r.updated_at,
  }));
}

/** The earliest week that still has an unfinished game (defaults to week 1). */
export async function fetchCurrentWeek(): Promise<number> {
  const { data, error } = await supabase
    .from("games")
    .select("week_num, state")
    .neq("state", "post")
    .order("week_num", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.week_num ?? TOTAL_WEEKS;
}

export type WeeklyStanding = StoredStanding & { weekNum: number };

/** Every stored weekly row for a league (week 1+), with usernames attached. */
export async function fetchWeeklyStandings(leagueId: string): Promise<WeeklyStanding[]> {
  const { data, error } = await supabase
    .from("league_standings")
    .select("user_id, week_num, rank, correct, missed, tb_diff, submitted, updated_at")
    .eq("league_id", leagueId)
    .gt("week_num", 0)
    .order("week_num", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: profiles, error: pe } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", Array.from(new Set(rows.map((r) => r.user_id))));
  if (pe) throw pe;
  const byId = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  return rows.map((r) => ({
    userId: r.user_id,
    username: byId.get(r.user_id) ?? "Unknown player",
    weekNum: r.week_num,
    rank: r.rank,
    correct: r.correct,
    missed: r.missed,
    tbDiff: r.tb_diff,
    submitted: r.submitted,
    updatedAt: r.updated_at,
  }));
}

// ---- money: payouts & cash pool --------------------------------------------
export type Payout = {
  id: string;
  userId: string;
  username: string;
  potType: "weekly" | "season";
  weekNum: number | null;
  amount: number;
  note: string;
  createdAt: string;
};

export type CashTxn = {
  id: string;
  userId: string;
  username: string;
  kind: "deposit" | "withdrawal";
  amount: number;
  note: string;
  createdAt: string;
};

export function money(v: number | string | null | undefined) {
  return `$${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function usernames(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", Array.from(new Set(ids)));
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p.username]));
}

export async function fetchPayouts(leagueId: string): Promise<Payout[]> {
  const { data, error } = await supabase
    .from("payouts")
    .select("id, user_id, pot_type, week_num, amount, note, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const names = await usernames(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: names.get(r.user_id) ?? "Unknown player",
    potType: r.pot_type as "weekly" | "season",
    weekNum: r.week_num,
    amount: Number(r.amount),
    note: r.note,
    createdAt: r.created_at,
  }));
}

export async function addPayout(args: {
  leagueId: string;
  userId: string;
  createdBy: string;
  potType: "weekly" | "season";
  weekNum: number | null;
  amount: number;
  note: string;
}) {
  const { error } = await supabase.from("payouts").insert({
    league_id: args.leagueId,
    user_id: args.userId,
    created_by: args.createdBy,
    pot_type: args.potType,
    week_num: args.potType === "weekly" ? args.weekNum : null,
    amount: args.amount,
    note: args.note,
  });
  if (error) throw error;
}

export async function deletePayout(id: string) {
  const { error } = await supabase.from("payouts").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCashTxns(leagueId: string): Promise<CashTxn[]> {
  const { data, error } = await supabase
    .from("cash_transactions")
    .select("id, user_id, kind, amount, note, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const names = await usernames(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: names.get(r.user_id) ?? "Unknown player",
    kind: r.kind as "deposit" | "withdrawal",
    amount: Number(r.amount),
    note: r.note,
    createdAt: r.created_at,
  }));
}

export async function addCashTxn(args: {
  leagueId: string;
  userId: string;
  kind: "deposit" | "withdrawal";
  amount: number;
  note: string;
}) {
  const { error } = await supabase.from("cash_transactions").insert({
    league_id: args.leagueId,
    user_id: args.userId,
    kind: args.kind,
    amount: args.amount,
    note: args.note,
  });
  if (error) throw error;
}

export async function deleteCashTxn(id: string) {
  const { error } = await supabase.from("cash_transactions").delete().eq("id", id);
  if (error) throw error;
}

/** Net balance per member: deposits - withdrawals + payouts received. */
export function cashBalances(txns: CashTxn[], payouts: Payout[]) {
  const map = new Map<string, { deposited: number; withdrawn: number; won: number }>();
  const get = (id: string) =>
    map.get(id) ?? (map.set(id, { deposited: 0, withdrawn: 0, won: 0 }), map.get(id)!);
  for (const t of txns) {
    const row = get(t.userId);
    if (t.kind === "deposit") row.deposited += t.amount;
    else row.withdrawn += t.amount;
  }
  for (const p of payouts) get(p.userId).won += p.amount;
  return map;
}

// ---- league chat -----------------------------------------------------------
export type ChatMessage = {
  id: string;
  userId: string;
  username: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export async function fetchMessages(leagueId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("league_messages")
    .select("id, user_id, body, pinned, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];
  const names = await usernames(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: names.get(r.user_id) ?? "Unknown player",
    body: r.body,
    pinned: r.pinned,
    createdAt: r.created_at,
  }));
}

export async function sendMessage(args: { leagueId: string; userId: string; body: string }) {
  const { error } = await supabase.from("league_messages").insert({
    league_id: args.leagueId,
    user_id: args.userId,
    body: args.body,
  });
  if (error) throw error;
}

export async function deleteMessage(id: string) {
  const { error } = await supabase.from("league_messages").delete().eq("id", id);
  if (error) throw error;
}

export async function setMessagePinned(id: string, pinned: boolean) {
  const { error } = await supabase.from("league_messages").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function setChatLocked(leagueId: string, locked: boolean) {
  const { error } = await supabase
    .from("leagues")
    .update({ chat_locked: locked })
    .eq("id", leagueId);
  if (error) throw error;
}

// ---- league bank -----------------------------------------------------------
export type BankDeposit = {
  id: string;
  amount: number;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

export async function fetchBankDeposits(leagueId: string): Promise<BankDeposit[]> {
  const { data, error } = await supabase
    .from("league_bank_deposits")
    .select("id, amount, note, created_by, created_at")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const names = await usernames(rows.map((r) => r.created_by));
  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    note: r.note,
    createdBy: r.created_by,
    createdByName: names.get(r.created_by) ?? "Commissioner",
    createdAt: r.created_at,
  }));
}

export async function addBankDeposit(args: {
  leagueId: string;
  createdBy: string;
  amount: number;
  note: string;
}) {
  const { error } = await supabase.from("league_bank_deposits").insert({
    league_id: args.leagueId,
    created_by: args.createdBy,
    amount: args.amount,
    note: args.note,
  });
  if (error) throw error;
}

export async function deleteBankDeposit(id: string) {
  const { error } = await supabase.from("league_bank_deposits").delete().eq("id", id);
  if (error) throw error;
}

/** Money the league bank holds: commissioner + member deposits − withdrawals − payouts. */
export function bankSummary(deposits: BankDeposit[], txns: CashTxn[], payouts: Payout[]) {
  const commissioner = deposits.reduce((s, d) => s + d.amount, 0);
  const memberDeposits = txns
    .filter((t) => t.kind === "deposit")
    .reduce((s, t) => s + t.amount, 0);
  const withdrawals = txns
    .filter((t) => t.kind === "withdrawal")
    .reduce((s, t) => s + t.amount, 0);
  const paid = payouts.reduce((s, p) => s + p.amount, 0);
  return {
    commissioner,
    memberDeposits,
    withdrawals,
    paid,
    balance: commissioner + memberDeposits - withdrawals - paid,
  };
}
