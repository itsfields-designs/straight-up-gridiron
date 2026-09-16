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

import { fetchCurrentWeek, fetchLeague, fetchMembers, TOTAL_WEEKS } from "@/lib/pool";
import { refreshNfl } from "@/lib/nfl.functions";
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
  head: () => ({
    meta: [
      { title: "League — Gridiron Gods" },
      { name: "description", content: "Make your weekly picks and check the league standings." },
      { property: "og:title", content: "League — Gridiron Gods" },
      {
        property: "og:description",
        content: "Make your weekly picks and check the league standings.",
      },
    ],
  }),
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
  const refresh = useServerFn(refreshNfl);
  const [tab, setTab] = useState<Tab>("picks");
  const [week, setWeek] = useState<number | null>(null);

  // Scores stream in live; this is just a backstop pull when someone opens the page.
  useLiveScores();
  const sync = useQuery({
    queryKey: ["nfl-sync"],
    queryFn: () => refresh({ data: {} }),
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

  const currentWeek = useQuery({ queryKey: ["current-week"], queryFn: fetchCurrentWeek });

  useEffect(() => {
    if (week == null && currentWeek.data) setWeek(currentWeek.data);
  }, [currentWeek.data, week]);

  const activeWeek = week ?? currentWeek.data ?? 1;

  const league = useQuery({ queryKey: ["league", leagueId], queryFn: () => fetchLeague(leagueId) });
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
      <Link to="/leagues" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <ArrowLeft size={15} /> All leagues
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">{league.data.name}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{league.data.rules}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-faint" htmlFor="week">
            Week
          </label>
          <select
            id="week"
            value={activeWeek}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm sm:w-28"
          >
            {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sticky top-[3.4rem] z-20 -mx-4 mb-5 border-b border-border bg-background/95 px-4 backdrop-blur sm:static sm:mx-0 sm:mb-6 sm:px-0 sm:backdrop-blur-none">
        <div className="no-scrollbar flex snap-x gap-1 overflow-x-auto" role="tablist" aria-label="League sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex min-h-12 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium sm:px-3.5 ${
                tab === t.id ? "border-accent text-foreground" : "border-transparent text-faint"
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "picks" && <PicksPanel leagueId={leagueId} week={activeWeek} userId={user.id} />}
      {tab === "standings" && (
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
      {tab === "schedule" && <SchedulePanel week={activeWeek} />}
    </div>
  );
}
