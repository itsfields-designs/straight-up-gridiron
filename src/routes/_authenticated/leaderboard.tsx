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
  fetchMyLeagues,
  fetchPayouts,
  fetchStandings,
  fetchWeeklyStandings,
  money,
} from "@/lib/pool";
import { useLiveScores } from "@/hooks/useLiveScores";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Gridiron Pool" },
      {
        name: "description",
        content: "Top performers in your NFL pick'em leagues, with points won each week.",
      },
      { property: "og:title", content: "Leaderboard — Gridiron Pool" },
      {
        property: "og:description",
        content: "Top performers in your NFL pick'em leagues, with points won each week.",
      },
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

  const wonBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payouts.data ?? []) map.set(p.userId, (map.get(p.userId) ?? 0) + p.amount);
    return map;
  }, [payouts.data]);

  const players = useMemo(() => {
    const rows = season.data ?? [];
    return rows.slice(0, 6).map((r, i) => ({
      userId: r.userId,
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
        const row = rows.find((r) => r.weekNum === w && r.userId === p.userId);
        const pts = row?.correct ?? 0;
        const total = (running.get(p.userId) ?? 0) + pts;
        running.set(p.userId, total);
        point[p.username] = cumulative ? total : pts;
      }
      return point;
    });
  }, [weekly.data, players, cumulative]);

  if (leagues.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (!leagues.data?.length)
    return (
      <div>
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Join or create a league and the leaderboard will fill in here.
        </p>
      </div>
    );

  const top = (season.data ?? []).slice(0, 3);
  const activeLeague = leagues.data.find((l) => l.id === activeId);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leaderboard</h1>
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
            className="rounded-md border border-input bg-card px-3 py-2.5 text-sm"
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
        <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { label: "Entry fee", value: activeLeague.entry_fee },
            { label: "Weekly pot", value: activeLeague.weekly_pot },
            { label: "Season pot", value: activeLeague.season_pot },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-3.5">
              <div className="text-xs text-faint">{c.label}</div>
              <div className="font-display text-lg font-medium">{money(c.value)}</div>
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
          <div className="flex gap-1 rounded-md bg-secondary p-1">
            {([true, false] as const).map((v) => (
              <button
                key={String(v)}
                onClick={() => setCumulative(v)}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
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
          <div className="h-72 w-full">
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
                    key={p.userId}
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
