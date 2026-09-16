import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";

import { fetchCurrentWeek, fetchMyLeagues, fetchStandings } from "@/lib/pool";
import { useLiveScores } from "@/hooks/useLiveScores";
import { UsernameEditor } from "@/components/UsernameEditor";
import { MembershipCard } from "@/components/MembershipCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Gridiron Gods" },
      {
        name: "description",
        content: "All your NFL pick'em leagues, the current week, and standings at a glance.",
      },
      { property: "og:title", content: "Dashboard — Gridiron Gods" },
      {
        property: "og:description",
        content: "All your NFL pick'em leagues, the current week, and standings at a glance.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  useLiveScores();
  const { user } = Route.useRouteContext();

  const leagues = useQuery({ queryKey: ["leagues"], queryFn: fetchMyLeagues });
  const currentWeek = useQuery({ queryKey: ["current-week"], queryFn: fetchCurrentWeek });

  const standings = useQueries({
    queries: (leagues.data ?? []).map((l) => ({
      queryKey: ["standings", l.id, 0],
      queryFn: () => fetchStandings(l.id, 0),
    })),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold sm:text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {currentWeek.data
          ? `Week ${currentWeek.data} is on the clock. Here's where you stand everywhere.`
          : "Here's where you stand in every league."}
      </p>

      <div className="mt-5 grid gap-3">
        <MembershipCard />
        <UsernameEditor userId={user.id} />
      </div>

      {leagues.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {leagues.data?.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <p className="text-sm text-muted-foreground">You haven't joined a league yet.</p>
          <Link
            to="/leagues"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground"
          >
            <Plus size={15} /> Start or join a league
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {(leagues.data ?? []).map((league, i) => {
          const rows = standings[i]?.data ?? [];
          const me = rows.find((r) => r.userId === user.id);
          const top = rows.slice(0, 3);
          const mySets = rows.filter((r) => r.userId === user.id).length;
          return (
            <div key={league.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    to="/leagues/$leagueId"
                    params={{ leagueId: league.id }}
                    className="flex items-center gap-1 font-medium hover:underline"
                  >
                    {league.name} <ChevronRight size={15} className="text-faint" />
                  </Link>
                  <div className="mt-0.5 text-xs text-faint">
                    Week {currentWeek.data ?? "—"} · {rows.length || "No"}{" "}
                    {rows.length === 1 ? "set of picks" : "sets of picks"} ranked
                    {mySets > 1 ? ` · ${mySets} of them yours` : ""}
                  </div>
                </div>
                <div className="rounded-md bg-secondary px-3 py-1.5 text-xs">
                  {me ? (
                    <>
                      <span className="font-semibold">#{me.rank}</span> · {me.correct}-{me.missed}
                    </>
                  ) : (
                    "No picks graded yet"
                  )}
                </div>
              </div>

              {top.length > 0 && (
                <ul className="mt-3 grid gap-1.5">
                  {top.map((r) => (
                    <li
                      key={`${r.userId}-${r.entryNo}`}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                        r.userId === user.id ? "bg-accent-soft text-accent-soft-foreground" : "bg-secondary"
                      }`}
                    >
                      <span className="truncate">
                        <span className="mr-2 text-muted-foreground tabular-nums">{r.rank}</span>
                        {r.username}
                      </span>
                      <span className="tabular-nums">
                        {r.correct}-{r.missed}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
