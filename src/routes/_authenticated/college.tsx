import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Globe, Lock, RefreshCw, Trophy } from "lucide-react";

import { toast } from "sonner";

import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { NcaaPickDeadline, useNcaaWeekLocked } from "@/components/pool/NcaaPickDeadline";
import { refreshCfb } from "@/lib/cfb.functions";
import {
  TOTAL_CFB_WEEKS,
  fetchCfbCurrentWeek,
  fetchCfbRankings,
  fetchCfbStandings,
  fetchCfbWeek,
  fetchMyCfbPicks,
  gradeCfbGame,
  saveCfbPicks,
  type CfbGame,
} from "@/lib/cfb";
import { type Side } from "@/lib/pool";

export const Route = createFileRoute("/_authenticated/college")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "College Top 25 — Gridiron Gods" },
      {
        name: "description",
        content:
          "AP Top 25 rankings, every ranked-team matchup and weekly college pick'em with a live leaderboard.",
      },
      { property: "og:title", content: "College Top 25 — Gridiron Gods" },
      {
        property: "og:description",
        content:
          "AP Top 25 rankings, every ranked-team matchup and weekly college pick'em with a live leaderboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollegePage,
});

type Tab = "rankings" | "picks" | "leaderboard";

const TABS: { id: Tab; label: string }[] = [
  { id: "rankings", label: "Top 25" },
  { id: "picks", label: "Picks" },
  { id: "leaderboard", label: "Leaderboard" },
];

function CollegePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const runRefresh = useServerFn(refreshCfb);
  const [tab, setTab] = useState<Tab>("rankings");
  const [syncing, setSyncing] = useState(false);
  const [week, setWeek] = useState<number | null>(null);

  const currentWeek = useQuery({ queryKey: ["cfb-current-week"], queryFn: fetchCfbCurrentWeek });
  useEffect(() => {
    if (week == null && currentWeek.data) setWeek(currentWeek.data);
  }, [currentWeek.data, week]);
  const activeWeek = week ?? currentWeek.data ?? 1;

  const top25 = useQuery({ queryKey: ["cfb-standings", 0], queryFn: () => fetchCfbStandings(0) });
  const top25Rows = top25.data ?? [];
  const top25Me = top25Rows.find((r) => r.userId === user.id);
  const top25Leader = top25Rows[0];

  const sync = async () => {
    setSyncing(true);
    try {
      await runRefresh({ data: {} });
      await queryClient.invalidateQueries();
      toast.success("Rankings and college scores updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the college feed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
          College football
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-semibold">AP Top 25</h1>
        <p className="mt-1 text-sm text-primary-foreground/80">
          Every game with a ranked team, plus the Top 25 pick'em — one free board open to every
          player on Gridiron Gods, league or not.
        </p>
        <button
          onClick={sync}
          disabled={syncing}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Updating…" : "Refresh rankings & scores"}
        </button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-accent-soft-foreground">
              <Globe size={13} aria-hidden="true" /> Open to everyone
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold">Top 25 pick&rsquo;em</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              One board, every player on Gridiron Gods. No league, no entry fee — just bragging
              rights.
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold tabular-nums">
            {top25Me ? `#${top25Me.rank}` : "—"}
          </span>
        </div>

        <p className="mt-2 text-xs text-faint">
          {top25Rows.length > 0
            ? `${top25Rows.length} ${top25Rows.length === 1 ? "player" : "players"} in the running${
                top25Leader ? ` · led by ${top25Leader.username}` : ""
              }`
            : "Be the first on the board this season."}
          {top25Me ? ` · you're ${top25Me.correct}–${top25Me.missed}` : ""}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTab("picks")}
            className="flex min-h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
          >
            Make your picks
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className="flex min-h-11 items-center justify-center rounded-xl border border-border-strong text-sm font-medium"
          >
            Leaderboard
          </button>
        </div>
      </section>

      <div role="tablist" aria-label="College sections" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rankings" && <RankingsTab />}
      {tab === "picks" && <PicksTab userId={user.id} week={activeWeek} onWeekChange={setWeek} />}
      {tab === "leaderboard" && (
        <LeaderboardTab week={activeWeek} onWeekChange={setWeek} userId={user.id} />
      )}
    </div>
  );
}

function WeekPicker({ week, onChange }: { week: number; onChange: (w: number) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {Array.from({ length: TOTAL_CFB_WEEKS }, (_, i) => i + 1).map((w) => (
        <button
          key={w}
          onClick={() => onChange(w)}
          aria-current={w === week}
          className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-medium ${
            w === week
              ? "bg-primary text-primary-foreground"
              : "border border-border-strong text-muted-foreground"
          }`}
        >
          W{w}
        </button>
      ))}
    </div>
  );
}

function RankingsTab() {
  const rankings = useQuery({ queryKey: ["cfb-rankings"], queryFn: fetchCfbRankings });

  if (rankings.isLoading) return <LoadingState label="Loading the AP Top 25" />;
  if (!rankings.data?.length)
    return (
      <EmptyState
        title="No rankings yet"
        description="Tap “Refresh rankings & scores” to pull the latest AP Top 25."
      />
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {rankings.data.map((r, i) => (
        <div
          key={r.rank}
          className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
        >
          <span className="w-7 shrink-0 text-center font-display text-base font-semibold tabular-nums">
            {r.rank}
          </span>
          {r.logo ? (
            <img src={r.logo} alt="" className="h-7 w-7 shrink-0 object-contain" />
          ) : (
            <span className="h-7 w-7 shrink-0 rounded-full bg-secondary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.team}</p>
            <p className="text-xs text-faint">
              {r.record || "—"}
              {r.first_place_votes > 0 ? ` · ${r.first_place_votes} first-place votes` : ""}
            </p>
          </div>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.points}</span>
        </div>
      ))}
    </div>
  );
}

function rankTag(rank: number | null) {
  return rank ? <span className="mr-1 rounded bg-accent-soft px-1 py-0.5 text-[11px] font-bold text-accent-soft-foreground">#{rank}</span> : null;
}

function PicksTab({
  userId,
  week,
  onWeekChange,
}: {
  userId: string;
  week: number;
  onWeekChange: (w: number) => void;
}) {
  const queryClient = useQueryClient();
  const weekQuery = useQuery({ queryKey: ["cfb-week", week], queryFn: () => fetchCfbWeek(week) });
  const picksQuery = useQuery({
    queryKey: ["cfb-picks", userId, week],
    queryFn: () => fetchMyCfbPicks(userId, week),
  });

  const [draft, setDraft] = useState<Record<string, Side>>({});
  const [tiebreaker, setTiebreaker] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(picksQuery.data?.picks ?? {});
    setTiebreaker(
      picksQuery.data?.tiebreaker != null ? String(picksQuery.data.tiebreaker) : "",
    );
  }, [picksQuery.data, week]);

  const games = weekQuery.data?.games ?? [];
  const locked = useNcaaWeekLocked(games, weekQuery.data?.week?.locked);
  const tbGameId = weekQuery.data?.week?.tiebreaker_game_id ?? null;
  const savedTiebreaker =
    picksQuery.data?.tiebreaker != null ? String(picksQuery.data.tiebreaker) : "";
  const dirty = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(picksQuery.data?.picks ?? {}) ||
      tiebreaker !== savedTiebreaker,
    [draft, picksQuery.data, tiebreaker, savedTiebreaker],
  );

  const choose = (game: CfbGame, side: Side) => {
    if (locked) return;
    setDraft((d) => ({ ...d, [game.id]: side }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCfbPicks({
        userId,
        weekNum: week,
        picks: draft,
        tiebreaker: tiebreaker === "" ? null : Number(tiebreaker),
      });
      await queryClient.invalidateQueries({ queryKey: ["cfb-picks", userId, week] });
      toast.success(`Week ${week} college picks saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your picks");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      <WeekPicker week={week} onChange={onWeekChange} />
      {weekQuery.isLoading ? (
        <LoadingState label="Loading matchups" />
      ) : !games.length ? (
        <EmptyState
          title={`No ranked games for Week ${week} yet`}
          description="Once the schedule is out, every game with a Top 25 team shows up here."
        />
      ) : (
        <>
          <NcaaPickDeadline games={games} storedLocked={weekQuery.data?.week?.locked ?? false} />
          <p className="text-sm text-muted-foreground">
            {Object.keys(draft).length} of {games.length} picked
          </p>
          <div className="grid gap-2.5">
            {games.map((g) => {
              const winner = gradeCfbGame(g);
              const pick = draft[g.id];
              return (
                <article key={g.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between text-xs text-faint">
                    <span className="flex items-center gap-2">
                      {g.slot}
                      {g.id === tbGameId && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-soft-foreground">
                          Tiebreaker
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      {locked && <Lock size={11} />}
                      {g.state === "post" ? "Final" : g.state === "in" ? "Live" : "Scheduled"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(["away", "home"] as Side[]).map((side) => {
                      const name = side === "away" ? g.away : g.home;
                      const logo = side === "away" ? g.away_logo : g.home_logo;
                      const rank = side === "away" ? g.away_rank : g.home_rank;
                      const score = side === "away" ? g.away_score : g.home_score;
                      const selected = pick === side;
                      const won = winner === side;
                      return (
                        <button
                          key={side}
                          onClick={() => choose(g, side)}
                          disabled={locked}
                          aria-pressed={selected}
                          className={`flex min-h-16 flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors disabled:opacity-70 ${
                            selected
                              ? "border-accent bg-accent-soft"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {logo ? (
                              <img src={logo} alt="" className="h-5 w-5 object-contain" />
                            ) : null}
                            <span className="text-xs text-faint">
                              {side === "away" ? "Away" : "Home"}
                            </span>
                          </span>
                          <span className="text-sm font-medium leading-tight">
                            {rankTag(rank)}
                            {name}
                            {won && " ✓"}
                          </span>
                          {score != null && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {score}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {g.id === tbGameId && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="text-sm text-muted-foreground" htmlFor="cfb-tb">
                        Combined final score, both teams:
                      </label>
                      <input
                        id="cfb-tb"
                        type="number"
                        disabled={locked}
                        value={tiebreaker}
                        onChange={(e) => setTiebreaker(e.target.value)}
                        placeholder="52"
                        className="min-h-11 w-24 rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <button
            onClick={save}
            disabled={!dirty || saving || locked}
            className={`sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] min-h-12 rounded-xl px-4 text-sm font-semibold ${
              dirty && !locked
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {saving
              ? "Saving…"
              : locked
                ? "Picks locked for this week"
                : dirty
                  ? `Save Week ${week} picks`
                  : "Picks saved"}
          </button>
        </>
      )}
    </div>
  );
}

function LeaderboardTab({
  week,
  onWeekChange,
  userId,
}: {
  week: number;
  onWeekChange: (w: number) => void;
  userId: string;
}) {
  const [scope, setScope] = useState<"week" | "season">("week");
  const target = scope === "season" ? 0 : week;
  const standings = useQuery({
    queryKey: ["cfb-standings", target],
    queryFn: () => fetchCfbStandings(target),
  });
  const rows = standings.data ?? [];
  const me = rows.find((r) => r.userId === userId);

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl bg-accent-soft px-4 py-3">
        <p className="text-sm font-semibold text-accent-soft-foreground">
          Everyone on Gridiron Gods plays this board
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {rows.length > 0
            ? `${rows.length} ${rows.length === 1 ? "player" : "players"} competing${
                me ? ` · you're #${me.rank}` : ""
              }`
            : "No league needed — first picks put you on the board."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">

        {(["week", "season"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            aria-pressed={scope === s}
            className={`min-h-11 rounded-lg text-sm ${
              scope === s ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"
            }`}
          >
            {s === "week" ? `Week ${week}` : "Season"}
          </button>
        ))}
      </div>
      {scope === "week" && <WeekPicker week={week} onChange={onWeekChange} />}

      {standings.isLoading ? (
        <LoadingState label="Loading the leaderboard" />
      ) : !standings.data?.length ? (
        <EmptyState
          title="No results yet"
          description="Make your Top 25 picks — the board fills in as ranked games go final."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {standings.data.map((row, i) => (
            <div
              key={`${row.userId}-${row.weekNum}`}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""} ${
                row.userId === userId ? "bg-accent-soft" : ""
              }`}
            >
              <span className="w-7 text-center font-display text-base font-semibold tabular-nums">
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {row.username}
                {row.userId === userId && <span className="text-faint"> · you</span>}
              </span>
              {row.rank === 1 && <Trophy size={15} className="text-accent" />}
              <span className="shrink-0 text-sm tabular-nums">
                {row.correct}
                <span className="text-faint">–{row.missed}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
