import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Trophy } from "lucide-react";
import { toast } from "sonner";

import {
  autoPots,
  fetchBankDeposits,
  fetchEntryPayments,
  money,
  saveLeaguePots,
  syncSeasonPotDeposit,
  type League,
} from "@/lib/pool";

export function SeasonPotPanel({
  league,
  currentUserId,
  isOwner,
}: {
  league: League;
  currentUserId: string;
  isOwner: boolean;
}) {
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ["entry-payments", league.id],
    queryFn: () => fetchEntryPayments(league.id),
  });
  const deposits = useQuery({
    queryKey: ["bank", league.id],
    queryFn: () => fetchBankDeposits(league.id),
  });

  const rows = payments.data ?? [];
  const auto = autoPots(rows, league, 0);
  const fee = Number(league.entry_fee) || 0;

  const [share, setShare] = useState(String(league.season_pot_pct ?? 0));
  const [manualSeason, setManualSeason] = useState(String(league.season_pot ?? 0));

  useEffect(() => {
    setShare(String(league.season_pot_pct ?? 0));
    setManualSeason(String(league.season_pot ?? 0));
  }, [league.season_pot_pct, league.season_pot]);

  const bankDeposits = deposits.data ?? [];
  const heldInBank = bankDeposits
    .filter((d) => d.note.startsWith("Season pot · Week"))
    .reduce((s, d) => s + d.amount, 0);

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

  const saveShare = useMutation({
    mutationFn: async () => {
      const pct = Math.min(Math.max(Number(share) || 0, 0), 100);
      const pots = autoPots(rows, { ...league, season_pot_pct: pct }, 0);
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: Number(league.weekly_pot) || 0,
        seasonPot: pots.season,
        potsAuto: true,
        seasonPotPct: pct,
      });
      const shareFrac = pct / 100;
      const weekNums = [...new Set(rows.map((r) => r.weekNum))];
      for (const w of weekNums) {
        const count = rows.filter((p) => p.weekNum === w).length;
        await syncSeasonPotDeposit({
          leagueId: league.id,
          weekNum: w,
          amount: count * fee * shareFrac,
          createdBy: currentUserId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Season pot share saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveManual = useMutation({
    mutationFn: async () => {
      const n = Number(manualSeason);
      if (!Number.isFinite(n) || n < 0) throw new Error("Amount must be zero or more");
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: Number(league.weekly_pot) || 0,
        seasonPot: Math.round(n * 100) / 100,
        potsAuto: false,
      });
    },
    onSuccess: () => {
      toast.success("Season pot saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Trophy size={15} /> Season pot
        </h2>
        <div className="text-xs text-faint">
          {league.pots_auto ? "Auto-calculated from payments" : "Manual amount"}
        </div>
      </div>

      {league.pots_auto ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-faint">Season pot (auto)</div>
              <div className="font-display text-lg font-medium">{money(auto.season)}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {rows.length > 0
                  ? `${rows.length} paid set${rows.length === 1 ? "" : "s"} × ${money(fee)} × ${share || 0}%`
                  : "No payments yet"}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-faint">Held in league bank</div>
              <div className="font-display text-lg font-medium">{money(heldInBank)}</div>
            </div>
          </div>

          {isOwner && (
            <label className="block">
              <span className="mb-1 block text-xs text-faint">Season pot share (%)</span>
              <div className="flex items-end gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={share}
                  onChange={(e) => setShare(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => saveShare.mutate()}
                  disabled={saveShare.isPending}
                  className="min-h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
                >
                  {saveShare.isPending ? "Saving…" : "Apply"}
                </button>
              </div>
              <p className="mt-1 text-xs text-faint">
                Share of each entry fee that funds the season pot. The rest funds the weekly pot.
              </p>
            </label>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-faint">Season pot (manual)</div>
            <div className="font-display text-lg font-medium">
              {money(Number(league.season_pot) || 0)}
            </div>
          </div>
          {isOwner && (
            <label className="block">
              <span className="mb-1 block text-xs text-faint">Season pot ($)</span>
              <div className="flex items-end gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={manualSeason}
                  onChange={(e) => setManualSeason(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => saveManual.mutate()}
                  disabled={saveManual.isPending}
                  className="min-h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
                >
                  {saveManual.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </label>
          )}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-faint">
        <Landmark size={13} /> The season pot is held in the league bank and paid out from there.
      </p>
    </div>
  );
}
