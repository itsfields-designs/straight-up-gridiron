import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  ClipboardList,
  Landmark,
  MessageSquare,
  Settings,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { fetchLeague, fetchMembers } from "@/lib/pool";
import { fetchLeagueCurrentWeek, isCollegeLeague, totalWeeksFor } from "@/lib/league-sport";
import { refreshNfl } from "@/lib/nfl.functions";
import { refreshCfb } from "@/lib/cfb.functions";
import { useLiveScores } from "@/hooks/useLiveScores";
import { PicksPanel } from "@/components/pool/PicksPanel";
import { StandingsPanel } from "@/components/pool/StandingsPanel";
import { MembersPanel } from "@/components/pool/MembersPanel";
import { SchedulePanel } from "@/components/pool/SchedulePanel";
import { PotPanel } from "@/components/pool/PotPanel";
import { CashPanel } from "@/components/pool/CashPanel";
import { ChatPanel } from "@/components/pool/ChatPanel";
import { BankPanel } from "@/components/pool/BankPanel";
import { LoadingState } from "@/components/ui/feedback";


export const Route = createFileRoute("/_authenticated/leagues/$leagueId")({
  staticData: { sitemap: false },
  loader: async ({ params }) => {
    // Private page: only look up the name in the browser, where the member is signed in.
    if (typeof window === "undefined") return { leagueName: null as string | null };
    try {
      const league = await fetchLeague(params.leagueId);
      return { leagueName: league?.name ?? null };
    } catch {
      return { leagueName: null as string | null };
    }
  },
  head: ({ loaderData }) => {
    const name = loaderData?.leagueName;
    const title = name ? `${name} — Gridiron Gods` : "Your league — Gridiron Gods";
    const description = name
      ? `Weekly picks, standings and payouts for ${name} on Gridiron Gods.`
      : "Make your weekly picks and check the league standings.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: LeaguePage,
});

type Tab = "picks" | "standings" | "pot" | "cash" | "bank" | "chat" | "members" | "schedule";

const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: "picks", label: "Make picks", icon: ClipboardList },
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "pot", label: "Pot & payouts", icon: Banknote },
  { id: "cash", label: "Cash pool", icon: Wallet },
  { id: "bank", label: "League bank", icon: Landmark },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "members", label: "Members", icon: Users },
  { id: "schedule", label: "Schedule & results", icon: Settings },
];

function LeaguePage() {
  const { leagueId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const refreshNflFn = useServerFn(refreshNfl);
  const refreshCfbFn = useServerFn(refreshCfb);
  const [tab, setTab] = useState<Tab>("picks");
  const [week, setWeek] = useState<number | null>(null);

  const league = useQuery({ queryKey: ["league", leagueId], queryFn: () => fetchLeague(leagueId) });
  const sport = league.data?.sport ?? "nfl";
  const college = league.data ? isCollegeLeague(league.data) : false;

  // Scores stream in live; this is just a backstop pull when someone opens the page.
  useLiveScores();
  const sync = useQuery({
    queryKey: ["sport-sync", sport],
    queryFn: () => (college ? refreshCfbFn({ data: {} }) : refreshNflFn({ data: {} })),
    enabled: Boolean(league.data),
    staleTime: 300_000,
    refetchInterval: 300_000,
    retry: false,
  });

  useEffect(() => {
    if (!sync.dataUpdatedAt) return;
    queryClient.invalidateQueries({ queryKey: ["week"] });
    queryClient.invalidateQueries({ queryKey: ["all-weeks"] });
    queryClient.invalidateQueries({ queryKey: ["standings"] });
  }, [sync.dataUpdatedAt, queryClient]);

  const currentWeek = useQuery({
    queryKey: ["current-week", sport],
    queryFn: () => fetchLeagueCurrentWeek(sport),
    enabled: Boolean(league.data),
  });

  useEffect(() => {
    if (week == null && currentWeek.data) setWeek(currentWeek.data);
  }, [currentWeek.data, week]);

  const activeWeek = week ?? currentWeek.data ?? 1;
  const members = useQuery({
    queryKey: ["members", leagueId],
    queryFn: () => fetchMembers(leagueId),
  });

  if (league.isLoading) return <LoadingState label="Loading league" />;
  if (league.isError || !league.data)
    return <p className="text-sm text-destructive">This league isn't available.</p>;

  const isOwner = league.data.owner_id === user.id;

  return (
    <div>
      <section className="-mx-4 -mt-4 mb-4 bg-primary px-4 pb-4 pt-3 text-primary-foreground sm:mx-0 sm:mt-0 sm:rounded-2xl sm:pt-4">
        <Link
          to="/leagues"
          className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-primary-foreground/75"
        >
          <ArrowLeft size={14} /> All leagues
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold">{league.data.name}</h1>
        <p className="mt-1 max-w-xl text-sm text-primary-foreground/75">{league.data.rules}</p>

        <div
          className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4"
          role="group"
          aria-label="Week"
        >
          {Array.from({ length: totalWeeksFor(sport) }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={activeWeek === w}
              onClick={() => setWeek(w)}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${
                activeWeek === w
                  ? "bg-accent text-accent-foreground"
                  : "bg-primary-foreground/10 text-primary-foreground/80"
              }`}
            >
              W{w}
            </button>
          ))}
        </div>
      </section>

      <div className="no-scrollbar sticky top-[3.5rem] z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur">
        {(college ? TABS.filter((t) => t.id !== "picks" && t.id !== "standings") : TABS).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>


      {college && (
        <Link
          to="/college"
          search={{ league: leagueId }}
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Picks & leaderboard</span>
            <span className="block text-xs text-muted-foreground">
              All college football lives on the College page.
            </span>
          </span>
          <span className="shrink-0 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground">
            Open College
          </span>
        </Link>
      )}
      {!college && tab === "picks" && (
        <PicksPanel league={league.data} week={activeWeek} userId={user.id} />
      )}
      {!college && tab === "standings" && (
        <StandingsPanel leagueId={leagueId} week={activeWeek} league={league.data} />
      )}
      {tab === "pot" && (
        <PotPanel
          league={league.data}
          members={members.data ?? []}
          isOwner={isOwner}
          currentUserId={user.id}
          week={activeWeek}
        />
      )}
      {tab === "cash" && (
        <CashPanel league={league.data} members={members.data ?? []} currentUserId={user.id} />
      )}
      {tab === "bank" && (
        <BankPanel league={league.data} isOwner={isOwner} currentUserId={user.id} />
      )}
      {tab === "chat" && (
        <ChatPanel league={league.data} isOwner={isOwner} currentUserId={user.id} />
      )}
      {tab === "members" && (
        <MembersPanel
          league={league.data}
          members={members.data ?? []}
          isOwner={isOwner}
          currentUserId={user.id}
        />
      )}
      {tab === "schedule" && <SchedulePanel week={activeWeek} league={league.data} />}
    </div>
  );
}
