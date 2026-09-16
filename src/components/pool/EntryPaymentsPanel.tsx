import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  autoPots,
  fetchEntryPayments,
  money,
  saveLeaguePots,
  setEntryPaid,
  type League,
  type Member,
} from "@/lib/pool";

export function EntryPaymentsPanel({
  league,
  members,
  isOwner,
  currentUserId,
  week,
}: {
  league: League;
  members: Member[];
  isOwner: boolean;
  currentUserId: string;
  week: number;
}) {
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ["entry-payments", league.id],
    queryFn: () => fetchEntryPayments(league.id),
  });

  const rows = payments.data ?? [];
  const auto = autoPots(rows, league, week);
  const fee = Number(league.entry_fee) || 0;

  const [manualWeekly, setManualWeekly] = useState(String(league.weekly_pot ?? 0));
  const [manualSeason, setManualSeason] = useState(String(league.season_pot ?? 0));
  const [share, setShare] = useState(String(league.season_pot_pct ?? 0));

  useEffect(() => {
    setManualWeekly(String(league.weekly_pot ?? 0));
    setManualSeason(String(league.season_pot ?? 0));
    setShare(String(league.season_pot_pct ?? 0));
  }, [league.weekly_pot, league.season_pot, league.season_pot_pct]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["entry-payments", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    queryClient.invalidateQueries({ queryKey: ["leagues"] });
  };

  const toggle = useMutation({
    mutationFn: async ({ userId, paid }: { userId: string; paid: boolean }) => {
      await setEntryPaid({
        leagueId: league.id,
        weekNum: week,
        userId,
        markedBy: currentUserId,
        amount: fee,
        paid,
      });
      if (league.pots_auto) {
        const next = paid
          ? [...rows, { id: "tmp", weekNum: week, userId, amount: fee }]
          : rows.filter((p) => !(p.weekNum === week && p.userId === userId));
        const pots = autoPots(next, league, week);
        await saveLeaguePots({
          leagueId: league.id,
          weeklyPot: pots.weekly,
          seasonPot: pots.season,
        });
      }
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const saveManual = useMutation({
    mutationFn: async () => {
      const num = (v: string) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new Error("Amounts must be zero or more");
        return Math.round(n * 100) / 100;
      };
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: num(manualWeekly),
        seasonPot: num(manualSeason),
        potsAuto: false,
      });
    },
    onSuccess: () => {
      toast.success("Pot amounts saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setAuto = useMutation({
    mutationFn: async (on: boolean) => {
      const pct = Math.min(Math.max(Number(share) || 0, 0), 100);
      const pots = autoPots(rows, { ...league, season_pot_pct: pct }, week);
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: on ? pots.weekly : Number(league.weekly_pot) || 0,
        seasonPot: on ? pots.season : Number(league.season_pot) || 0,
        potsAuto: on,
        seasonPotPct: pct,
      });
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const paidSet = new Set(
    rows.filter((p) => p.weekNum === week).map((p) => p.userId),
  );

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CheckCircle2 size={15} /> Week {week} entry payments
        </h2>
        <div className="text-xs text-faint">
          {auto.weekPaid} of {members.length} paid · {money(auto.weekPaid * fee)} collected
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {members.map((m, i) => (
          <label
            key={m.user_id}
            className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 ${
              i > 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="text-sm font-medium">{m.username}</span>
            <span className="flex items-center gap-2 text-xs text-faint">
              {paidSet.has(m.user_id) ? `Paid ${money(fee)}` : "Not paid"}
              <input
                type="checkbox"
                className="h-4 w-4 accent-[hsl(var(--accent))]"
                checked={paidSet.has(m.user_id)}
                disabled={!isOwner || toggle.isPending}
                onChange={(e) => toggle.mutate({ userId: m.user_id, paid: e.target.checked })}
              />
            </span>
          </label>
        ))}
        {members.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-faint">No members yet.</p>
        )}
      </div>

      {isOwner && (
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[hsl(var(--accent))]"
              checked={league.pots_auto}
              onChange={(e) => setAuto.mutate(e.target.checked)}
            />
            Calculate pot amounts automatically from payments received
          </label>

          {league.pots_auto ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-faint">Weekly pot (auto)</div>
                <div className="font-display text-lg font-medium">{money(auto.weekly)}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-faint">Season pot (auto)</div>
                <div className="font-display text-lg font-medium">{money(auto.season)}</div>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs text-faint">Season pot share (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={share}
                  onChange={(e) => setShare(e.target.value)}
                  onBlur={() => setAuto.mutate(true)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs text-faint">Weekly pot ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={manualWeekly}
                  onChange={(e) => setManualWeekly(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-faint">Season pot ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={manualSeason}
                  onChange={(e) => setManualSeason(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="flex items-end">
                <button
                  onClick={() => saveManual.mutate()}
                  disabled={saveManual.isPending}
                  className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
                >
                  {saveManual.isPending ? "Saving…" : "Save pot amounts"}
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-faint">
            Suggested from payments: {money(auto.weekPaid * fee)} collected this week
            {fee > 0 ? ` (${auto.weekPaid} × ${money(fee)})` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
