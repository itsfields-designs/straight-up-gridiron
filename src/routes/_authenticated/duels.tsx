import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Crown, Flame, Lock, Swords, Zap } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { SznPassGate, useEntitled } from "@/components/SznPassGate";
import { TeamBadge } from "@/components/pool/TeamBadge";
import {
  createDuel,
  getDuelBoard,
  respondToDuel,
  saveDuelPicks,
  searchDuelOpponents,
} from "@/lib/duels.functions";
import type { Side } from "@/lib/pool";

export const Route = createFileRoute("/_authenticated/duels")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Face The Gods — head-to-head pick'em duels" },
      {
        name: "description",
        content:
          "Challenge any player to a one-on-one week of NFL picks, or take on the Gods themselves for bragging rights.",
      },
      { property: "og:title", content: "Face The Gods — head-to-head pick'em duels" },
      {
        property: "og:description",
        content:
          "Challenge any player to a one-on-one week of NFL picks, or take on the Gods themselves for bragging rights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DuelsPage,
});

type Tab = "duels" | "leaderboard";

function DuelsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { entitled, loading: entitlementLoading } = useEntitled();
  const [tab, setTab] = useState<Tab>("duels");
  const [openDuelId, setOpenDuelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Side>>({});
  const [search, setSearch] = useState("");

  const loadBoard = useServerFn(getDuelBoard);
  const loadOpponents = useServerFn(searchDuelOpponents);
  const runCreate = useServerFn(createDuel);
  const runRespond = useServerFn(respondToDuel);
  const runSave = useServerFn(saveDuelPicks);

  const board = useQuery({
    queryKey: ["duel-board"],
    queryFn: () => loadBoard({ data: {} }),
    refetchInterval: 60_000,
  });

  const opponents = useQuery({
    queryKey: ["duel-opponents", search],
    queryFn: () => loadOpponents({ data: { query: search || undefined } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["duel-board"] });

  const create = useMutation({
    mutationFn: (vars: { vsGods: boolean; opponentId?: string | null }) =>
      runCreate({ data: vars }),
    onSuccess: (res) => {
      toast.success("Challenge created. Make your picks.");
      setOpenDuelId(res.duelId);
      setDraft({});
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: (vars: { duelId: string; accept: boolean }) => runRespond({ data: vars }),
    onSuccess: () => {
      toast.success("Done.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: (vars: { duelId: string; picks: Record<string, Side> }) =>
      runSave({ data: vars }),
    onSuccess: () => {
      toast.success("Picks saved.");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = board.data;
  const gated = !entitled;
  const games = data?.games ?? [];
  const duels = data?.duels ?? [];

  const mine = duels.filter((d) => d.mySide !== null && d.status !== "declined");
  const openSeats = duels.filter(
    (d) => d.status === "open" && d.mySide === null && (!d.opponent.userId || d.opponent.userId === user.id),
  );

  const activeDuel = useMemo(() => duels.find((d) => d.id === openDuelId) ?? null, [duels, openDuelId]);

  const startEditing = (duelId: string, picks: Record<string, Side>) => {
    setOpenDuelId(duelId);
    setDraft(picks);
  };

  if (board.isLoading) return <LoadingState label="Loading duels" />;

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-accent/50 bg-primary p-5 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
          Week {data?.weekNum} · bragging rights
        </p>
        <h1 className="mt-1.5 flex items-center gap-2 font-display text-4xl font-semibold">
          <Swords size={22} /> Face The Gods
        </h1>
        <p className="mt-1 text-sm text-primary-foreground/80">
          One week of NFL picks, one on one. Beat another player — or take on the Gods themselves.
        </p>
        {data?.myRecord && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-sm font-semibold">
            <Crown size={15} /> {data.myRecord.wins}-{data.myRecord.losses}
            {data.myRecord.ties ? `-${data.myRecord.ties}` : ""}
            {data.myRecord.streak > 1 ? ` · ${data.myRecord.streak} in a row` : ""}
          </p>
        )}
        {data?.locked && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-primary-foreground/80">
            <Lock size={14} /> Picks are locked for this week.
          </p>
        )}
      </section>

      {gated && !entitlementLoading && <SznPassGate what="Starting or joining a duel" />}

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(["duels", "leaderboard"] as Tab[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-11 rounded-lg text-sm font-semibold capitalize ${
               tab === id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            }`}
          >
            {id === "duels" ? "Duels" : "Leaderboard"}
          </button>
        ))}
      </div>

      {tab === "leaderboard" ? (
        <section className="rounded-xl border border-border-strong bg-card p-4">
          <h2 className="font-display text-lg font-semibold">Duel leaderboard</h2>
          {(data?.leaderboard ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No duels settled yet. Be the first name on the board.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {(data?.leaderboard ?? []).map((row, i) => (
                <li
                  key={row.userId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    row.userId === user.id ? "bg-accent-soft" : "bg-secondary"
                  }`}
                >
                  <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{row.username}</span>
                  {row.godsWins > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent-soft-foreground">
                      <Zap size={12} /> {row.godsWins}
                    </span>
                  )}
                  {row.bestStreak > 1 && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Flame size={12} /> {row.bestStreak}
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {row.wins}-{row.losses}
                    {row.ties ? `-${row.ties}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border-strong bg-card p-4">
            <h2 className="font-display text-lg font-semibold">Start a duel</h2>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={gated || data?.locked || create.isPending}
                onClick={() => create.mutate({ vsGods: true })}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-foreground disabled:opacity-50"
              >
                <Zap size={16} /> Face The Gods
              </button>
              <button
                type="button"
                disabled={gated || data?.locked || create.isPending}
                onClick={() => create.mutate({ vsGods: false, opponentId: null })}
                className="flex min-h-12 items-center justify-center rounded-xl border border-border-strong text-sm font-medium disabled:opacity-50"
              >
                Post an open challenge
              </button>
            </div>

            <div className="mt-4">
              <label htmlFor="duel-search" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Or challenge a player
              </label>
              <input
                id="duel-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username"
                className="mt-1.5 min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
              <ul className="mt-2 grid gap-1.5">
                {(opponents.data ?? []).slice(0, 6).map((o) => (
                  <li key={o.userId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{o.username}</span>
                    <button
                      type="button"
                      disabled={gated || data?.locked || create.isPending}
                      onClick={() => create.mutate({ vsGods: false, opponentId: o.userId })}
                      className="min-h-10 shrink-0 rounded-lg bg-secondary px-3 text-xs font-semibold disabled:opacity-50"
                    >
                      Challenge
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {openSeats.length > 0 && (
            <section className="grid gap-2">
              <h2 className="font-display text-lg font-semibold">Challenges waiting</h2>
              {openSeats.map((d) => (
                <article
                  key={d.id}
                  className="flex items-center gap-3 rounded-xl border border-border-strong bg-card p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{d.challenger.username}</p>
                    <p className="text-xs text-faint">
                      {d.opponent.userId ? "Challenged you directly" : "Open seat · anyone can take it"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={gated}
                    onClick={() => respond.mutate({ duelId: d.id, accept: true })}
                    className="disabled:opacity-50 min-h-10 shrink-0 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground"
                  >
                    Accept
                  </button>
                  {d.opponent.userId && (
                    <button
                      type="button"
                      onClick={() => respond.mutate({ duelId: d.id, accept: false })}
                      className="min-h-10 shrink-0 rounded-lg border border-border-strong px-3 text-xs font-medium"
                    >
                      Decline
                    </button>
                  )}
                </article>
              ))}
            </section>
          )}

          <section className="grid gap-2">
            <h2 className="font-display text-lg font-semibold">Your duels</h2>
            {mine.length === 0 ? (
              <EmptyState
                icon={Swords}
                title="No duels yet"
                description="Take on the Gods or challenge a friend — winner takes the bragging rights."
              />
            ) : (
              mine.map((d) => {
                const me = d.mySide === "challenger" ? d.challenger : d.opponent;
                const them = d.mySide === "challenger" ? d.opponent : d.challenger;
                const won = d.status === "final" && d.winnerId === user.id;
                const lost = d.status === "final" && !won && (d.winnerId || d.godsWon);
                return (
                  <article key={d.id} className="rounded-xl border border-border-strong bg-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base font-semibold">
                          You vs {them.username}
                        </p>
                        <p className="text-xs text-faint">
                          Week {d.weekNum} ·{" "}
                          {d.status === "open"
                            ? "waiting for an opponent"
                            : d.status === "final"
                              ? won
                                ? "you won"
                                : lost
                                  ? "you lost"
                                  : "tied"
                              : "live"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-sm font-semibold tabular-nums">
                        {me.correct}–{them.correct}
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(d.id, me.picks)}
                        className="min-h-11 flex-1 rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
                      >
                        {data?.locked || d.status === "final" ? "View picks" : "Make picks"}
                      </button>
                    </div>

                    {openDuelId === d.id && (
                      <div className="mt-3 grid gap-2">
                        {games.map((g) => {
                          const myPick = draft[g.id] ?? me.picks[g.id];
                          const theirPick = them.picks[g.id];
                          const editable = !gated && !data?.locked && d.status !== "final";
                          return (
                            <div key={g.id} className="rounded-xl border border-border p-2.5">
                              <div className="grid grid-cols-2 gap-2">
                                {(["away", "home"] as Side[]).map((side) => {
                                  const team = side === "away" ? g.away : g.home;
                                  const chosen = myPick === side;
                                  return (
                                    <button
                                      key={side}
                                      type="button"
                                      disabled={!editable}
                                      onClick={() => setDraft((p) => ({ ...p, [g.id]: side }))}
                                      className={`flex min-h-12 items-center gap-2 rounded-lg border-2 px-2 text-left text-sm ${
                                        chosen ? "border-accent bg-accent-soft" : "border-border"
                                      } disabled:opacity-80`}
                                    >
                                      <TeamBadge name={team} size={24} />
                                      <span className="min-w-0 truncate font-medium">{team}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="mt-1.5 text-xs text-faint">
                                {theirPick
                                  ? `${them.username}: ${theirPick === "home" ? g.home : g.away}`
                                  : `Hidden until kickoff`}
                                {g.away_score != null && g.home_score != null
                                  ? ` · ${g.away_score}–${g.home_score}`
                                  : ""}
                              </p>
                            </div>
                          );
                        })}

                        {!gated && !data?.locked && d.status !== "final" && (
                          <button
                            type="button"
                            disabled={save.isPending}
                            onClick={() => save.mutate({ duelId: d.id, picks: draft })}
                            className="min-h-12 rounded-xl bg-success text-sm font-semibold text-primary disabled:opacity-60"
                          >
                            Save {Object.keys(draft).length} of {games.length} picks
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}
