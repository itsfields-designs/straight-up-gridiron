import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchCurrentWeek,
  fetchEntryPayments,
  fetchMyLeagues,
  fetchPayouts,
  fetchSeasonEntryPayments,
  fetchStandings,
  fetchWeeklyStandings,
  money,
  seasonPotFor,
  weeklyPotFor,
} from "@/lib/pool";
import { useLiveScores } from "@/hooks/useLiveScores";
import { LoadingState } from "@/components/ui/feedback";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Gridiron Gods" },
      {
        name: "description",
        content: "Top performers in your NFL pick'em leagues, with points won each week.",
      },
      { property: "og:title", content: "Leaderboard — Gridiron Gods" },
      {
        property: "og:description",
        content: "Top performers in your NFL pick'em leagues, with points won each week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeaderboardPage,
});

const LINE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const PODIUM = [
  { icon: Crown, label: "1st" },
  { icon: Trophy, label: "2nd" },
  { icon: Medal, label: "3rd" },
];

function LeaderboardPage() {
  useLiveScores();
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [cumulative, setCumulative] = useState(true);

  const leagues = useQuery({ queryKey: ["leagues"], queryFn: fetchMyLeagues });
  const activeId = leagueId ?? leagues.data?.[0]?.id ?? null;

  const season = useQuery({
    queryKey: ["standings", activeId, 0],
    queryFn: () => fetchStandings(activeId!, 0),
    enabled: !!activeId,
  });

  const weekly = useQuery({
    queryKey: ["weekly-standings", activeId],
    queryFn: () => fetchWeeklyStandings(activeId!),
    enabled: !!activeId,
  });

  const payouts = useQuery({
    queryKey: ["payouts", activeId],
    queryFn: () => fetchPayouts(activeId!),
    enabled: !!activeId,
  });

  const entryPayments = useQuery({
    queryKey: ["entry-payments", activeId],
    queryFn: () => fetchEntryPayments(activeId!),
    enabled: !!activeId,
  });

  const currentWeek = useQuery({ queryKey: ["current-week"], queryFn: fetchCurrentWeek });
  const seasonEntryPayments = useQuery({
    queryKey: ["season-entry-payments", activeId],
    queryFn: () => fetchSeasonEntryPayments(activeId!),
    enabled: !!activeId,
  });

  const wonBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payouts.data ?? []) map.set(p.userId, (map.get(p.userId) ?? 0) + p.amount);
    return map;
  }, [payouts.data]);

  const players = useMemo(() => {
    const rows = season.data ?? [];
    return rows.slice(0, 6).map((r, i) => ({
      key: `${r.userId}-${r.entryNo}`,
      userId: r.userId,
      entryNo: r.entryNo,
      username: r.username,
      color: LINE_COLORS[i % LINE_COLORS.length],
    }));
  }, [season.data]);

  const chartData = useMemo(() => {
    const rows = weekly.data ?? [];
    if (!rows.length || !players.length) return [];
    const weeks = Array.from(new Set(rows.map((r) => r.weekNum))).sort((a, b) => a - b);
    const running = new Map<string, number>();
    return weeks.map((w) => {
      const point: Record<string, number | string> = { week: `W${w}` };
      for (const p of players) {
        const row = rows.find(
          (r) => r.weekNum === w && r.userId === p.userId && r.entryNo === p.entryNo,
        );
        const pts = row?.correct ?? 0;
        const total = (running.get(p.key) ?? 0) + pts;
        running.set(p.key, total);
        point[p.username] = cumulative ? total : pts;
      }
      return point;
    });
  }, [weekly.data, players, cumulative]);

  if (leagues.isLoading) return <LoadingState label="Loading leaderboard" />;

  if (!leagues.data?.length)
    return (
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Join or create a league and the leaderboard will fill in here.
        </p>
      </div>
    );

  const top = (season.data ?? []).slice(0, 3);
  const activeLeague = leagues.data.find((l) => l.id === activeId);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Top performers and how many games each of them has called right per week.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs text-faint" htmlFor="league">
            League
          </label>
          <select
            id="league"
            value={activeId ?? ""}
            onChange={(e) => setLeagueId(e.target.value)}
            className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm sm:w-auto"
          >
            {leagues.data.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {activeLeague && (
        <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-2.5">
          {[
             { label: "Weekly fee", value: activeLeague.entry_fee },
            {
              label: `Week ${currentWeek.data ?? 1} pot`,
              value: weeklyPotFor(
                activeLeague,
                entryPayments.data ?? [],
                currentWeek.data ?? 1,
              ),
            },
             { label: "Season pot", value: seasonPotFor(activeLeague, seasonEntryPayments.data ?? []) },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-3 sm:p-3.5">
              <div className="text-xs text-muted-foreground">{c.label}</div>
              <div className="font-display text-base font-medium sm:text-lg">{money(c.value)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
        {PODIUM.map((slot, i) => {
          const row = top[i];
          const Icon = slot.icon;
          return (
            <div key={slot.label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-accent-soft-foreground">
                <Icon size={14} /> {slot.label}
              </div>
              <div className="mt-2 truncate text-lg font-semibold">{row?.username ?? "—"}</div>
              <div className="text-sm text-muted-foreground tabular-nums">
                {row ? `${row.correct}-${row.missed} this season` : "No results yet"}
              </div>
              {row && (
                <div className="text-sm tabular-nums text-accent-soft-foreground">
                  {money(wonBy.get(row.userId) ?? 0)} won
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">
            {cumulative ? "Running total of correct picks" : "Correct picks each week"}
          </h2>
          <div className="flex gap-1 rounded-md bg-secondary p-1" role="tablist" aria-label="Chart view">
            {([true, false] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                role="tab"
                aria-selected={cumulative === v}
                onClick={() => setCumulative(v)}
                className={`min-h-11 rounded px-3 text-xs font-medium ${
                  cumulative === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {v ? "Running total" : "Per week"}
              </button>
            ))}
          </div>
        </div>

        {weekly.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading chart…</p>
        ) : chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-faint">
            Once picks are graded, the weekly chart shows up here.
          </p>
        ) : (
          <div className="h-60 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "var(--faint)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "var(--faint)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {players.map((p) => (
                  <Line
                    key={p.key}
                    type="monotone"
                    dataKey={p.username}
                    stroke={p.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
