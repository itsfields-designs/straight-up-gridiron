import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Settings, Trophy, Users } from "lucide-react";

import { fetchCurrentWeek, fetchLeague, fetchMembers, TOTAL_WEEKS } from "@/lib/pool";
import { refreshNfl } from "@/lib/nfl.functions";
import { PicksPanel } from "@/components/pool/PicksPanel";
import { StandingsPanel } from "@/components/pool/StandingsPanel";
import { MembersPanel } from "@/components/pool/MembersPanel";
import { SchedulePanel } from "@/components/pool/SchedulePanel";


export const Route = createFileRoute("/_authenticated/leagues/$leagueId")({
  head: () => ({
    meta: [
      { title: "League — Gridiron Pool" },
      { name: "description", content: "Make your weekly picks and check the league standings." },
      { property: "og:title", content: "League — Gridiron Pool" },
      {
        property: "og:description",
        content: "Make your weekly picks and check the league standings.",
      },
    ],
  }),
  component: LeaguePage,
});

type Tab = "picks" | "standings" | "members" | "schedule";

const TABS: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: "picks", label: "Make picks", icon: ClipboardList },
  { id: "standings", label: "Standings", icon: Trophy },
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

  // Keep the real NFL schedule, scores and standings fresh in the background.
  const sync = useQuery({
    queryKey: ["nfl-sync"],
    queryFn: () => refresh({ data: {} }),
    staleTime: 120_000,
    refetchInterval: 120_000,
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

  if (league.isLoading) return <p className="text-sm text-muted-foreground">Loading league…</p>;
  if (league.isError || !league.data)
    return <p className="text-sm text-destructive">This league isn't available.</p>;

  const isOwner = league.data.owner_id === user.id;

  return (
    <div>
      <Link to="/leagues" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft size={15} /> All leagues
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{league.data.name}</h1>
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
            className="w-28 rounded-md border border-input bg-card px-3 py-2.5 text-sm"
          >
            {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium ${
              tab === t.id ? "border-accent text-foreground" : "border-transparent text-faint"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "picks" && <PicksPanel leagueId={leagueId} week={activeWeek} userId={user.id} />}
      {tab === "standings" && (
        <StandingsPanel leagueId={leagueId} week={activeWeek} />
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
