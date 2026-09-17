import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  autoPots,
  fetchEntryPayments,
  fetchPickEntries,
  money,
  saveLeaguePots,
  setEntryPaid,
  syncSeasonPotDeposit,
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
  const picks = useQuery({
    queryKey: ["picks", league.id, week],
    queryFn: () => fetchPickEntries(league.id, week),
  });

  const rows = payments.data ?? [];
  const auto = autoPots(rows, league, week);
  const fee = Number(league.entry_fee) || 0;

  const [manualWeekly, setManualWeekly] = useState(String(league.weekly_pot ?? 0));
  // Extra payable sets the commissioner has opened up by hand, per member.
  const [extraSets, setExtraSets] = useState<Record<string, number>>({});

  useEffect(() => {
    setManualWeekly(String(league.weekly_pot ?? 0));
  }, [league.weekly_pot]);

  useEffect(() => setExtraSets({}), [week, league.id]);

  const refresh = () => {
    for (const key of [
      ["entry-payments", league.id],
      ["league", league.id],
      ["leagues"],
      ["bank", league.id],
      ["cash", league.id],
      ["payouts", league.id],
      ["standings", league.id],
    ]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const toggle = useMutation({
    mutationFn: async ({
      userId,
      entryNo,
      paid,
    }: {
      userId: string;
      entryNo: number;
      paid: boolean;
    }) => {
      await setEntryPaid({
        leagueId: league.id,
        weekNum: week,
        userId,
        entryNo,
        markedBy: currentUserId,
        amount: fee,
        paid,
      });
      if (league.pots_auto) {
        const next = paid
          ? [
              ...rows,
              {
                id: "tmp",
                weekNum: week,
                userId,
                entryNo,
                amount: fee,
                createdAt: new Date().toISOString(),
              },
            ]

          : rows.filter(
              (p) => !(p.weekNum === week && p.userId === userId && p.entryNo === entryNo),
            );
        const pots = autoPots(next, league, week);
        await saveLeaguePots({
          leagueId: league.id,
          weeklyPot: pots.weekly,
          seasonPot: pots.season,
        });
        const share = Math.min(Math.max(Number(league.season_pot_pct) || 0, 0), 100) / 100;
        const weekPaidCount = next.filter((p) => p.weekNum === week).length;
        await syncSeasonPotDeposit({
          leagueId: league.id,
          weekNum: week,
          amount: weekPaidCount * fee * share,
          createdBy: currentUserId,
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
        if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be zero or more");
        return Math.round(n * 100) / 100;
      };
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: num(manualWeekly),
        seasonPot: Number(league.season_pot) || 0,
        potsAuto: false,
      });
    },
    onSuccess: () => {
      toast.success("Weekly pot saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setAuto = useMutation({
    mutationFn: async (on: boolean) => {
      const pct = Math.min(Math.max(Number(league.season_pot_pct) || 0, 0), 100);
      const pots = autoPots(rows, { ...league, season_pot_pct: pct }, week);
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: on ? pots.weekly : Number(league.weekly_pot) || 0,
        seasonPot: on ? pots.season : Number(league.season_pot) || 0,
        potsAuto: on,
        seasonPotPct: pct,
      });
      const weekPaidCount = rows.filter((p) => p.weekNum === week).length;
      await syncSeasonPotDeposit({
        leagueId: league.id,
        weekNum: week,
        amount: on ? (weekPaidCount * fee * pct) / 100 : 0,
        createdBy: currentUserId,
      });
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const weekPayments = rows.filter((p) => p.weekNum === week);
  const weekPicks = picks.data ?? [];

  /** Sets shown for a member: however many they submitted or paid for, at least one. */
  const setsFor = (userId: string) => {
    const paidMax = Math.max(
      0,
      ...weekPayments.filter((p) => p.userId === userId).map((p) => p.entryNo),
    );
    const pickedMax = Math.max(
      0,
      ...weekPicks.filter((p) => p.user_id === userId).map((p) => p.entry_no),
    );
    const count = Math.max(1, paidMax, pickedMax, extraSets[userId] ?? 0);
    return Array.from({ length: count }, (_, i) => i + 1);
  };

  const isPaid = (userId: string, entryNo: number) =>
    weekPayments.some((p) => p.userId === userId && p.entryNo === entryNo);

  const totalSets = members.reduce((s, m) => s + setsFor(m.user_id).length, 0);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <CheckCircle2 size={15} /> Week {week} entry payments
        </h2>
        <div className="text-xs text-faint">
          {auto.weekPaid} of {totalSets} sets paid · {money(auto.weekPaid * fee)} collected
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {members.map((m, i) => {
          const sets = setsFor(m.user_id);
          return (
            <div
              key={m.user_id}
              className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{m.username}</span>
                <span className="text-xs text-faint">
                  {sets.filter((n) => isPaid(m.user_id, n)).length} of {sets.length} sets paid
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {sets.map((n) => (
                  <label
                    key={n}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs transition-opacity ${isPaid(m.user_id, n) ? "border-accent bg-accent-soft" : "border-border"} ${toggle.isPending ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[hsl(var(--accent))]"
                      checked={isPaid(m.user_id, n)}
                      disabled={!isOwner || toggle.isPending}
                      onChange={(e) =>
                        toggle.mutate({ userId: m.user_id, entryNo: n, paid: e.target.checked })
                      }
                    />
                    Set {n}
                    <span className="text-faint">
                      {isPaid(m.user_id, n) ? money(fee) : "unpaid"}
                    </span>
                  </label>
                ))}
                {isOwner && (
                  <button
                    onClick={() =>
                      setExtraSets((s) => ({ ...s, [m.user_id]: sets.length + 1 }))
                    }
                    className="flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-muted-foreground"
                  >
                    <Plus size={13} /> Add set
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {members.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-faint">No members yet.</p>
        )}
      </div>

      {isOwner && (
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[hsl(var(--accent))]"
              checked={league.pots_auto}
              onChange={(e) => setAuto.mutate(e.target.checked)}
            />
            Calculate pot amounts automatically from payments received
          </label>

          {league.pots_auto ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-faint">Weekly pot (auto)</div>
                <div className="font-display text-lg font-medium">{money(auto.weekly)}</div>
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="text-xs text-faint">Season pot</div>
                <div className="font-display text-lg font-medium">{money(auto.season)}</div>
                <div className="mt-0.5 text-xs text-faint">Set the share in the Season pot tab</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => saveManual.mutate()}
                  disabled={saveManual.isPending}
                  className="w-full min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
                >
                  {saveManual.isPending ? "Saving…" : "Save weekly pot"}
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
