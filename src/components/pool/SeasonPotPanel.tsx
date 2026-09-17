import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Trophy } from "lucide-react";
import { toast } from "sonner";

import {
  fetchBankDeposits,
  fetchPickEntries,
  fetchSeasonEntryPayments,
  money,
  saveLeaguePots,
  setSeasonEntryPaid,
  seasonPotFor,
  syncSeasonPotDeposit,
  type League,
  type Member,
} from "@/lib/pool";

export function SeasonPotPanel({
  league,
  currentUserId,
  isOwner,
  members,
}: {
  league: League;
  currentUserId: string;
  isOwner: boolean;
  members: Member[];
}) {
  const queryClient = useQueryClient();
  const payments = useQuery({
    queryKey: ["season-entry-payments", league.id],
    queryFn: () => fetchSeasonEntryPayments(league.id),
  });
  const picks = useQuery({ queryKey: ["picks", league.id], queryFn: () => fetchPickEntries(league.id) });
  const deposits = useQuery({
    queryKey: ["bank", league.id],
    queryFn: () => fetchBankDeposits(league.id),
  });

  const rows = payments.data ?? [];
  const fee = Number(league.season_entry_fee) || 0;

  const [seasonFee, setSeasonFee] = useState(String(league.season_entry_fee ?? 0));
  const [manualSeason, setManualSeason] = useState(String(league.season_pot ?? 0));

  useEffect(() => {
    setSeasonFee(String(league.season_entry_fee ?? 0));
    setManualSeason(String(league.season_pot ?? 0));
  }, [league.season_entry_fee, league.season_pot]);

  const bankDeposits = deposits.data ?? [];
  const heldInBank = bankDeposits
    .filter((d) => d.note === "Season pot entry fees")
    .reduce((s, d) => s + d.amount, 0);

  const refresh = () => {
    for (const key of [
      ["season-entry-payments", league.id],
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

  const saveSettings = useMutation({
    mutationFn: async () => {
      const amount = Number(seasonFee);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Fee must be zero or more");
      const rounded = Math.round(amount * 100) / 100;
      const total = rows.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : rounded), 0);
      const { error } = await import("@/integrations/supabase/client").then(({ supabase }) =>
        supabase.from("leagues").update({ season_entry_fee: rounded }).eq("id", league.id),
      );
      if (error) throw error;
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: Number(league.weekly_pot) || 0,
        seasonPot: league.season_pot_auto ? total : Number(league.season_pot) || 0,
        seasonPotAuto: league.season_pot_auto,
      });
      await syncSeasonPotDeposit({ leagueId: league.id, amount: total, createdBy: currentUserId });
    },
    onSuccess: () => {
      toast.success("Season entry fee saved");
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
        seasonPotAuto: false,
      });
    },
    onSuccess: () => {
      toast.success("Season pot saved");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setAuto = useMutation({
    mutationFn: async (on: boolean) => {
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: Number(league.weekly_pot) || 0,
        seasonPot: on ? rows.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : fee), 0) : Number(league.season_pot) || 0,
        seasonPotAuto: on,
      });
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, entryNo, paid }: { userId: string; entryNo: number; paid: boolean }) => {
      await setSeasonEntryPaid({ leagueId: league.id, userId, entryNo, markedBy: currentUserId, amount: fee, paid });
      const next = paid
        ? [...rows, { id: "tmp", userId, entryNo, amount: fee, createdAt: new Date().toISOString() }]
        : rows.filter((p) => !(p.userId === userId && p.entryNo === entryNo));
      const total = next.reduce((sum, p) => sum + (p.amount > 0 ? p.amount : fee), 0);
      if (league.season_pot_auto) {
        await saveLeaguePots({ leagueId: league.id, weeklyPot: Number(league.weekly_pot) || 0, seasonPot: total });
      }
      await syncSeasonPotDeposit({ leagueId: league.id, amount: total, createdBy: currentUserId });
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const setsFor = (userId: string) => {
    const max = Math.max(1, ...rows.filter((p) => p.userId === userId).map((p) => p.entryNo), ...(picks.data ?? []).filter((p) => p.user_id === userId).map((p) => p.entry_no));
    return Array.from({ length: max }, (_, i) => i + 1);
  };
  const isPaid = (userId: string, entryNo: number) => rows.some((p) => p.userId === userId && p.entryNo === entryNo);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Trophy size={15} /> Season pot
        </h2>
        <div className="text-xs text-faint">
          {league.season_pot_auto ? "Auto-calculated from season fees" : "Manual amount"}
        </div>
      </div>

      {isOwner && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-faint">Season Pot entry fee per set ($)</span>
            <div className="flex items-end gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={seasonFee}
                onChange={(event) => setSeasonFee(event.target.value)}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => saveSettings.mutate()}
                disabled={saveSettings.isPending}
                className="min-h-11 shrink-0 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
              >
                {saveSettings.isPending ? "Saving…" : "Save fee"}
              </button>
            </div>
            <p className="mt-1 text-xs text-faint">This is charged in addition to the weekly entry fee.</p>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[hsl(var(--accent))]"
              checked={league.season_pot_auto}
              disabled={setAuto.isPending}
              onChange={(event) => setAuto.mutate(event.target.checked)}
            />
            Calculate the Season Pot automatically from paid Season Pot fees
          </label>
        </div>
      )}

      {league.season_pot_auto ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-faint">Season pot (auto)</div>
              <div className="font-display text-lg font-medium">{money(seasonPotFor(league, rows))}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {rows.length > 0
                  ? `${rows.length} paid set${rows.length === 1 ? "" : "s"} × ${money(fee)}`
                  : "No payments yet"}
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-faint">Held in league bank</div>
              <div className="font-display text-lg font-medium">{money(heldInBank)}</div>
            </div>
          </div>

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

      <div className="overflow-hidden rounded-md border border-border">
        {members.map((member, index) => (
          <div key={member.user_id} className={`px-4 py-3 ${index ? "border-t border-border" : ""}`}>
            <div className="text-sm font-medium">{member.username}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {setsFor(member.user_id).map((entryNo) => (
                <label key={entryNo} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs ${isPaid(member.user_id, entryNo) ? "border-accent bg-accent-soft" : "border-border"}`}>
                  <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--accent))]" checked={isPaid(member.user_id, entryNo)} disabled={!isOwner || toggle.isPending} onChange={(e) => toggle.mutate({ userId: member.user_id, entryNo, paid: e.target.checked })} />
                  Set {entryNo} <span className="text-faint">{isPaid(member.user_id, entryNo) ? money(fee) : "unpaid"}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-faint">
        <Landmark size={13} /> The season pot is held in the league bank and paid out from there.
      </p>
    </div>
  );
}
