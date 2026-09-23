import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Crown, Flame, Lock, Search, Swords, Zap } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { SznPassGate, useEntitled } from "@/components/SznPassGate";
import { TeamBadge } from "@/components/pool/TeamBadge";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";
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
type Sport = "nfl" | "cfb";

const SPORT_LABEL: Record<Sport, string> = { nfl: "NFL", cfb: "College" };

const AVATAR_STYLES = [
  "bg-destructive text-destructive-foreground",
  "bg-success text-primary-foreground",
  "bg-primary text-primary-foreground",
  "bg-accent-soft-foreground text-primary-foreground",
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function DuelsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { entitled, loading: entitlementLoading } = useEntitled();
  const [tab, setTab] = useState<Tab>("duels");
  const [sport, setSport] = useState<Sport>("nfl");
  const [openDuelId, setOpenDuelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, Side>>({});
  const [tiebreaker, setTiebreaker] = useState("");
  const [search, setSearch] = useState("");

  const loadBoard = useServerFn(getDuelBoard);
  const loadOpponents = useServerFn(searchDuelOpponents);
  const runCreate = useServerFn(createDuel);
  const runRespond = useServerFn(respondToDuel);
  const runSave = useServerFn(saveDuelPicks);

  const board = useQuery({
    queryKey: ["duel-board", sport],
    queryFn: () => loadBoard({ data: { sport } }),
    refetchInterval: 30_000,
  });

  const opponents = useQuery({
    queryKey: ["duel-opponents", search],
    queryFn: () => loadOpponents({ data: { query: search || undefined } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["duel-board"] });
    void queryClient.invalidateQueries({ queryKey: ["duel-pending"] });
  };

  const create = useMutation({
    mutationFn: (vars: { vsGods: boolean; opponentId?: string | null }) =>
      runCreate({ data: { ...vars, sport } }),

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
    mutationFn: (vars: {
      duelId: string;
      picks: Record<string, Side>;
      tiebreaker: number | null;
    }) => runSave({ data: vars }),
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

  // Direct challenges sent to me that I have not accepted or declined yet.
  const incoming = duels.filter(
    (d) => d.status === "open" && d.mySide === "opponent" && d.opponent.userId === user.id,
  );
  const mine = duels.filter(
    (d) =>
      d.mySide !== null && d.status !== "declined" && !incoming.some((pend) => pend.id === d.id),
  );
  // Public seats anyone can take.
  const openSeats = duels.filter(
    (d) => d.status === "open" && d.mySide === null && !d.opponent.userId,
  );

  const activeDuel = useMemo(
    () => duels.find((d) => d.id === openDuelId) ?? null,
    [duels, openDuelId],
  );
  const featuredDuel =
    mine.find((d) => d.status === "active" && d.weekNum === data?.weekNum) ??
    mine.find((d) => d.status === "active") ??
    mine[0] ??
    null;
  const recordByUser = new Map((data?.leaderboard ?? []).map((row) => [row.userId, row]));
  const decidedGames = games.filter((game) => game.state === "post").length;
  const liveGames = games.filter((game) => game.state === "in").length;

  // Real head-to-head scoreboard numbers for the featured duel.
  const myScore = featuredDuel
    ? featuredDuel.mySide === "challenger"
      ? featuredDuel.challenger.correct
      : featuredDuel.opponent.correct
    : 0;
  const theirScore = featuredDuel
    ? featuredDuel.mySide === "challenger"
      ? featuredDuel.opponent.correct
      : featuredDuel.challenger.correct
    : 0;
  const scoreTotal = myScore + theirScore;
  const sharePct = scoreTotal > 0 ? Math.round((myScore / scoreTotal) * 100) : 50;
  const leadLabel =
    myScore === theirScore
      ? "All square"
      : myScore > theirScore
        ? `You’re ahead by ${myScore - theirScore}`
        : `You’re behind by ${theirScore - myScore}`;
  const isLive = featuredDuel?.status === "active" && liveGames > 0;
  const statusLabel =
    featuredDuel?.status === "final"
      ? "Final"
      : isLive
        ? "Live"
        : featuredDuel?.status === "active"
          ? decidedGames > 0
            ? "In progress"
            : "Locked in"
          : "Pending";

  const startEditing = (
    duelId: string,
    picks: Record<string, Side>,
    savedTiebreaker?: number | null,
  ) => {
    setOpenDuelId(duelId);
    setDraft(picks);
    setTiebreaker(savedTiebreaker != null ? String(savedTiebreaker) : "");
    // Wait for the editor to render, then bring it into view.
    setTimeout(() => {
      document
        .getElementById(`duel-${duelId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  if (board.isLoading) return <LoadingState label="Loading duels" />;

  return (
    <div className="-mx-4 min-h-screen border-x border-border-strong bg-background sm:mx-0">
      <header className="flex min-h-20 items-center gap-3 border-b border-accent bg-primary px-4 text-primary-foreground sm:min-h-[7rem] sm:px-6">
        <img
          src={logoAsset.url}
          alt="Gridiron Gods"
          className="size-11 shrink-0 rounded-xl object-cover sm:size-14"
        />
        <h1 className="font-display text-3xl font-bold uppercase sm:text-4xl">Duels</h1>
        {data?.myRecord && (
          <span className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent-soft px-4 font-display text-base font-semibold text-accent-soft-foreground sm:min-h-12 sm:px-5 sm:text-lg">
            <Swords size={18} /> {data.myRecord.wins}-{data.myRecord.losses}
          </span>
        )}
      </header>

      <div className="grid gap-5 px-4 py-4 sm:gap-7 sm:px-8">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border-strong bg-secondary p-1">
          {(["nfl", "cfb"] as Sport[]).map((id) => (
            <Button
              key={id}
              variant={sport === id ? "default" : "ghost"}
              onClick={() => {
                setSport(id);
                setOpenDuelId(null);
                setDraft({});
              }}
              className="min-h-12 rounded-xl font-display text-base"
            >
              {SPORT_LABEL[id]}
            </Button>
          ))}
        </div>

        {featuredDuel && tab === "duels" && (
          <section className="rounded-[1.9rem] border border-accent bg-primary p-5 text-primary-foreground sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase ${
                  isLive
                    ? "bg-destructive-soft text-destructive"
                    : "bg-primary-foreground/10 text-primary-foreground/70"
                }`}
              >
                <span
                  className={`size-2.5 rounded-full ${isLive ? "animate-pulse bg-destructive" : "bg-primary-foreground/50"}`}
                />{" "}
                {statusLabel}
              </span>
              <span className="text-sm font-semibold text-primary-foreground/45">
                Week {featuredDuel.weekNum} · {decidedGames} of {games.length} decided
              </span>
            </div>
            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center sm:mt-7 sm:gap-4">
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-full border-4 border-accent/75 bg-accent font-display text-xl font-bold text-accent-foreground sm:size-20 sm:text-2xl">
                  {initials(
                    featuredDuel.mySide === "challenger"
                      ? featuredDuel.challenger.username
                      : featuredDuel.opponent.username,
                  )}
                </span>
                <p className="mt-2 font-display text-lg font-semibold text-accent sm:mt-3 sm:text-xl">
                  You
                </p>
                <p className="font-display text-3xl font-bold tabular-nums">{myScore}</p>
              </div>
              <div>
                <p className="font-display text-lg font-bold text-accent sm:text-xl">VS</p>
                <p className="mt-1 text-xs text-primary-foreground/50">bragging rights</p>
              </div>
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-full border-4 border-destructive/70 bg-destructive font-display text-xl font-bold text-destructive-foreground sm:size-20 sm:text-2xl">
                  {initials(
                    featuredDuel.mySide === "challenger"
                      ? featuredDuel.opponent.username
                      : featuredDuel.challenger.username,
                  )}
                </span>
                <p className="mt-2 truncate font-display text-lg font-semibold sm:mt-3 sm:text-xl">
                  {featuredDuel.mySide === "challenger"
                    ? featuredDuel.opponent.username
                    : featuredDuel.challenger.username}
                </p>
                <p className="font-display text-3xl font-bold tabular-nums">{theirScore}</p>
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-primary-foreground/20">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${sharePct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-primary-foreground/50">
              <span>{leadLabel}</span>
              <span>{Math.max(games.length - decidedGames, 0)} games left</span>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-accent/40 pt-4">
              <span className="flex items-center gap-2 text-sm text-primary-foreground/55">
                <Flame size={18} /> {data?.myRecord?.streak ?? 0}-pick streak
              </span>
              <Button
                onClick={() =>
                  startEditing(
                    featuredDuel.id,
                    featuredDuel.mySide === "challenger"
                      ? featuredDuel.challenger.picks
                      : featuredDuel.opponent.picks,
                    featuredDuel.mySide === "challenger"
                      ? featuredDuel.challenger.tiebreaker
                      : featuredDuel.opponent.tiebreaker,
                  )
                }
                className="min-w-36"
              >
                {data?.locked || featuredDuel.status === "final" ? "View picks" : "Make picks"}
              </Button>
            </div>
          </section>
        )}

        {gated && !entitlementLoading && <SznPassGate what="Starting or joining a duel" />}

        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
          {(["duels", "leaderboard"] as Tab[]).map((id) => (
            <Button
              key={id}
              variant={tab === id ? "default" : "ghost"}
              onClick={() => setTab(id)}
              className="min-h-14 rounded-xl font-display text-lg capitalize"
            >
              {id === "duels" ? "Duels" : "Leaderboard"}
            </Button>
          ))}
        </div>

        {tab === "leaderboard" ? (
          <section>
            <h2 className="font-display text-3xl font-semibold">Duel leaderboard</h2>
            {(data?.leaderboard ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No duels settled yet. Be the first name on the board.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {(data?.leaderboard ?? []).map((row, i) => (
                  <li
                    key={row.userId}
                    className={`flex items-center gap-3 rounded-xl border border-border px-3 py-3 ${
                      row.userId === user.id ? "bg-accent-soft" : "bg-secondary"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {row.username}
                    </span>
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
            <section className="rounded-[1.9rem] border border-accent bg-primary p-5 text-primary-foreground sm:p-7">
              <p className="flex items-center gap-2 font-display text-base font-semibold uppercase text-accent">
                <Zap size={19} /> {SPORT_LABEL[sport]} · Week {data?.weekNum} · bragging rights
              </p>
              <h2 className="mt-4 font-display text-3xl font-semibold sm:mt-5 sm:text-4xl">
                Face The Gods
              </h2>
              <p className="mt-2 text-base leading-relaxed text-primary-foreground/75">
                {sport === "cfb"
                  ? "One week of Top 25 college picks, one on one. Can you beat The Gods?"
                  : "One week of NFL picks, one on one. Can you beat The Gods?"}
              </p>

              <div className="mt-6 grid gap-2">
                <Button
                  disabled={gated || data?.locked || create.isPending}
                  onClick={() => create.mutate({ vsGods: true })}
                  className="min-h-16 rounded-2xl font-display text-xl"
                >
                  <Zap size={16} /> Face The Gods
                </Button>
                <Button
                  variant="ghost"
                  disabled={gated || data?.locked || create.isPending}
                  onClick={() => create.mutate({ vsGods: false, opponentId: null })}
                  className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Post an open challenge
                </Button>
              </div>
            </section>

            {incoming.length > 0 && (
              <section className="grid gap-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="font-display text-3xl font-semibold">Challenges for you</h2>
                  <span className="rounded-full bg-destructive px-3 py-1 text-sm font-semibold text-destructive-foreground">
                    {incoming.length} new
                  </span>
                </div>
                {incoming.map((d) => (
                  <article
                    key={d.id}
                    className="rounded-2xl border-2 border-accent bg-accent-soft p-4 text-accent-soft-foreground"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-destructive/70 bg-destructive font-display font-semibold text-destructive-foreground">
                        {initials(d.challenger.username)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-base font-semibold">
                          {d.challenger.username} challenged you to a duel
                        </p>
                        <p className="text-sm opacity-80">
                          {SPORT_LABEL[d.sport] ?? "NFL"} · Week {d.weekNum} · head to head
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button
                        disabled={gated || respond.isPending}
                        onClick={() => respond.mutate({ duelId: d.id, accept: true })}
                        className="min-h-14 flex-1 rounded-2xl font-display text-lg"
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ duelId: d.id, accept: false })}
                        className="min-h-14 rounded-2xl"
                      >
                        Decline
                      </Button>
                    </div>
                  </article>
                ))}
              </section>
            )}

            {openSeats.length > 0 && (
              <section className="grid gap-3">
                <div className="flex items-end justify-between gap-3">
                  <h2 className="font-display text-3xl font-semibold">Open challenges</h2>
                  <p className="text-sm text-muted-foreground">Anyone can take a seat</p>
                </div>
                {openSeats.map((d) => (
                  <article
                    key={d.id}
                    className="rounded-2xl border border-dashed border-accent bg-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-destructive/70 bg-destructive font-display font-semibold text-destructive-foreground">
                        {initials(d.challenger.username)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">
                          {d.challenger.username}’s open seat
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {d.opponent.userId
                            ? "Challenged you directly"
                            : "Open seat · anyone can take it"}
                        </p>
                      </div>
                    </div>
                    <Button
                      disabled={gated}
                      onClick={() => respond.mutate({ duelId: d.id, accept: true })}
                      className="mt-4 min-h-14 w-full rounded-2xl font-display text-lg"
                    >
                      Accept
                    </Button>
                    {d.opponent.userId && (
                      <Button
                        variant="ghost"
                        onClick={() => respond.mutate({ duelId: d.id, accept: false })}
                        className="mt-1 w-full"
                      >
                        Decline
                      </Button>
                    )}
                  </article>
                ))}
              </section>
            )}

            <section>
              <h2 className="font-display text-3xl font-semibold">Challenge a player</h2>
              <div className="relative mt-4">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={22}
                />
                <input
                  id="duel-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by username"
                  className="min-h-14 w-full rounded-2xl border border-border-strong bg-background pl-12 pr-4 text-base"
                />
              </div>
              <ul className="mt-3 grid gap-3">
                {(opponents.data ?? []).slice(0, 8).map((o, index) => {
                  const record = recordByUser.get(o.userId);
                  return (
                    <li
                      key={o.userId}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                    >
                      <span
                        className={`grid size-12 shrink-0 place-items-center rounded-full border-2 border-primary-foreground/30 font-display font-semibold ${AVATAR_STYLES[index % AVATAR_STYLES.length]}`}
                      >
                        {initials(o.username)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-semibold">{o.username}</p>
                        <p className="text-sm text-muted-foreground">
                          {record ? `${record.wins}-${record.losses} this season` : "Ready to duel"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={gated || data?.locked || create.isPending}
                        onClick={() => create.mutate({ vsGods: false, opponentId: o.userId })}
                        className="shrink-0 border-accent text-accent-soft-foreground"
                      >
                        Challenge
                      </Button>
                    </li>
                  );
                })}
              </ul>
              <Button
                variant="ghost"
                disabled={gated || data?.locked || create.isPending}
                onClick={() => create.mutate({ vsGods: false, opponentId: null })}
                className="mt-4 min-h-16 w-full rounded-2xl border border-dashed border-border-strong text-muted-foreground"
              >
                Or post an open seat anyone can accept.
              </Button>
            </section>

            <section className="grid gap-2">
              <h2 className="font-display text-3xl font-semibold">Your duels</h2>
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
                    <article
                      key={d.id}
                      id={`duel-${d.id}`}
                      className="scroll-mt-24 rounded-xl border border-border-strong bg-card p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-base font-semibold">
                            You vs {them.username}
                          </p>
                          <p className="text-xs text-faint">
                            {SPORT_LABEL[d.sport] ?? "NFL"} · Week {d.weekNum} ·{" "}
                            {d.status === "open"
                              ? them.userId
                                ? `waiting for ${them.username} to accept`
                                : "waiting for an opponent"
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
                        <Button
                          onClick={() => startEditing(d.id, me.picks, me.tiebreaker)}
                          className="min-h-11 flex-1 rounded-xl"
                        >
                          {data?.locked || d.status === "final" ? "View picks" : "Make picks"}
                        </Button>
                      </div>

                      {openDuelId === d.id && (
                        <div className="mt-3 grid gap-2">
                          {games.map((g) => {
                            const myPick = draft[g.id] ?? me.picks[g.id];
                            const theirPick = them.picks[g.id];
                            const editable = !gated && !data?.locked && d.status !== "final";
                            const godTalk = them.isGods ? them.reasoning?.[g.id] : undefined;
                            return (
                              <div key={g.id} className="rounded-xl border border-border p-2.5">
                                <div className="grid grid-cols-2 gap-2">
                                  {(["away", "home"] as Side[]).map((side) => {
                                    const team = side === "away" ? g.away : g.home;
                                    const rank = side === "away" ? g.away_rank : g.home_rank;
                                    const logo = side === "away" ? g.away_logo : g.home_logo;
                                    const chosen = myPick === side;
                                    return (
                                      <Button
                                        key={side}
                                        variant="outline"
                                        disabled={!editable}
                                        onClick={() => setDraft((p) => ({ ...p, [g.id]: side }))}
                                        className={`flex min-h-12 items-center gap-2 rounded-lg border-2 px-2 text-left text-sm ${
                                          chosen ? "border-accent bg-accent-soft" : "border-border"
                                        } disabled:opacity-80`}
                                      >
                                        {logo ? (
                                          <img
                                            src={logo}
                                            alt=""
                                            className="size-6 shrink-0 object-contain"
                                          />
                                        ) : (
                                          <TeamBadge name={team} size={24} />
                                        )}
                                        {rank ? (
                                          <span className="shrink-0 text-xs font-bold text-accent-soft-foreground">
                                            #{rank}
                                          </span>
                                        ) : null}
                                        <span className="min-w-0 truncate font-medium">{team}</span>
                                      </Button>
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
                                {godTalk && (
                                  <p className="mt-2 rounded-lg border-l-4 border-accent bg-accent-soft px-3 py-2 text-xs italic leading-relaxed text-accent-soft-foreground">
                                    <span className="mr-1 font-display font-bold not-italic uppercase">
                                      The Gods:
                                    </span>
                                    “{godTalk}”
                                  </p>
                                )}
                              </div>
                            );
                          })}

                          <div className="rounded-xl border-2 border-accent bg-accent-soft p-3">
                            <p className="font-display text-sm font-bold uppercase text-accent-soft-foreground">
                              Tiebreaker
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Combined score of {d.tiebreakerLabel ?? "the final game"} — closest
                              guess wins if you are level on picks.
                            </p>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={300}
                              value={tiebreaker}
                              disabled={gated || data?.locked || d.status === "final"}
                              onChange={(e) => setTiebreaker(e.target.value)}
                              placeholder="Total points"
                              className="mt-2 min-h-12 w-full rounded-lg border border-border-strong bg-background px-3 text-base"
                            />
                            <p className="mt-1.5 text-xs text-faint">
                              {them.tiebreaker != null
                                ? `${them.username}: ${them.tiebreaker}`
                                : "Their guess is hidden until kickoff"}
                              {d.tiebreakerTotal != null ? ` · actual ${d.tiebreakerTotal}` : ""}
                            </p>
                          </div>

                          {!gated && !data?.locked && d.status !== "final" && (
                            <Button
                              disabled={save.isPending}
                              onClick={() =>
                                save.mutate({
                                  duelId: d.id,
                                  picks: draft,
                                  tiebreaker: tiebreaker === "" ? null : Number(tiebreaker),
                                })
                              }
                              className="min-h-12 rounded-xl bg-success text-primary"
                            >
                              Save {Object.keys(draft).length} of {games.length} picks
                            </Button>
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
    </div>
  );
}
