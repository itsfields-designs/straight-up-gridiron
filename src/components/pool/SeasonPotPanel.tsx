import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Landmark, Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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
  const [extraSets, setExtraSets] = useState<Record<string, number>>({});
  const [showAllPaid, setShowAllPaid] = useState(false);

  useEffect(() => {
    setSeasonFee(String(league.season_entry_fee ?? 0));
    setManualSeason(String(league.season_pot ?? 0));
  }, [league.season_entry_fee, league.season_pot]);

  useEffect(() => {
    setExtraSets({});
    setShowAllPaid(false);
  }, [league.id]);

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

  /** Sets shown for a member: however many they submitted or paid for, at least one. */
  const setsFor = (userId: string) => {
    const paidMax = Math.max(
      0,
      ...rows.filter((p) => p.userId === userId).map((p) => p.entryNo),
    );
    const pickedMax = Math.max(
      0,
      ...(picks.data ?? []).filter((p) => p.user_id === userId).map((p) => p.entry_no),
    );
    const count = Math.max(1, paidMax, pickedMax, extraSets[userId] ?? 0);
    return Array.from({ length: count }, (_, i) => i + 1);
  };

  const isPaid = (userId: string, entryNo: number) =>
    rows.some((p) => p.userId === userId && p.entryNo === entryNo);

  const totalSets = members.reduce((s, m) => s + setsFor(m.user_id).length, 0);
  const paymentEntries = members.flatMap((member) =>
    setsFor(member.user_id).map((entryNo) => ({
      member,
      entryNo,
      paid: isPaid(member.user_id, entryNo),
    })),
  );
  const paidCount = paymentEntries.filter((entry) => entry.paid).length;
  const unpaidEntries = paymentEntries.filter((entry) => !entry.paid);
  const paidEntries = paymentEntries.filter((entry) => entry.paid);
  const visibleEntries = showAllPaid ? paymentEntries : [...unpaidEntries, ...paidEntries.slice(0, 5)];
  const hiddenPaidCount = showAllPaid ? 0 : Math.max(0, paidEntries.length - 5);
  const collectedAmount = paidCount * fee;

  const copyReminder = async () => {
    const names = Array.from(new Set(unpaidEntries.map((entry) => entry.member.username)));
    const message = `Friendly reminder: ${names.join(", ")} — your season entry payment of ${money(fee)} per set is still due for ${league.name}.`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Payment reminder copied");
    } catch {
      toast.error("Could not copy the reminder");
    }
  };

  return (
    <div className="space-y-4">
      <section className="app-card p-5 sm:p-6" aria-labelledby="season-entries-summary-heading">
        <h2 id="season-entries-summary-heading" className="flex items-center gap-1.5 text-2xl font-semibold">
          <Trophy size={20} className="text-accent" /> Season entries
        </h2>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-5xl font-semibold leading-none">{paidCount}</span>
          <span className="text-lg text-muted-foreground">of {totalSets} paid</span>
        </div>
        <progress
          className="mt-5 h-3 w-full overflow-hidden rounded-full accent-success"
          max={Math.max(totalSets, 1)}
          value={paidCount}
          aria-label={`${paidCount} of ${totalSets} season entries paid`}
        />
        <p className="mt-2 text-base text-muted-foreground">
          {money(collectedAmount)} of {money(totalSets * fee)} collected for the season
        </p>
      </section>

      <section className="app-card p-5 sm:p-6" aria-labelledby="season-paid-heading">
        <h2 id="season-paid-heading" className="text-2xl font-semibold">Who’s paid</h2>

        <div className="mt-4 divide-y divide-border">
          {visibleEntries.map(({ member, entryNo, paid }) => {
            const setCount = setsFor(member.user_id).length;
            return (
              <div key={`${member.user_id}-${entryNo}`} className="flex min-h-16 items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-base font-semibold">
                  {member.username}{setCount > 1 ? ` #${entryNo}` : ""}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!isOwner || toggle.isPending}
                  aria-pressed={paid}
                  aria-label={`Mark ${member.username} season set ${entryNo} ${paid ? "unpaid" : "paid"}`}
                  onClick={() => toggle.mutate({ userId: member.user_id, entryNo, paid: !paid })}
                  className={`h-11 min-w-28 rounded-full border-2 px-5 text-base shadow-none ${
                    paid
                      ? "border-success bg-secondary text-foreground hover:bg-secondary"
                      : "border-accent bg-accent-soft text-foreground hover:bg-accent-soft"
                  }`}
                >
                  {paid && <Check aria-hidden="true" />}
                  {paid ? "Paid" : "Unpaid"}
                </Button>
              </div>
            );
          })}

          {members.length === 0 && (
            <p className="py-6 text-center text-sm text-faint">No members yet.</p>
          )}
        </div>

        {hiddenPaidCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAllPaid(true)}
            className="mt-3 w-full border-dashed bg-card text-muted-foreground shadow-none"
          >
            {hiddenPaidCount} more {hiddenPaidCount === 1 ? "set" : "sets"} · all paid
          </Button>
        )}

        {isOwner && members.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {unpaidEntries.length > 0 && (
              <Button type="button" onClick={copyReminder} className="w-full text-base">
                <Copy aria-hidden="true" />
                Copy reminder for {unpaidEntries.length} unpaid
              </Button>
            )}
            <div className="flex flex-wrap gap-1">
              {members.map((member) => (
                <Button
                  key={member.user_id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setExtraSets((current) => ({
                      ...current,
                      [member.user_id]: setsFor(member.user_id).length + 1,
                    }))
                  }
                  className="text-muted-foreground"
                >
                  <Plus aria-hidden="true" /> Add set for {member.username}
                </Button>
              ))}
            </div>
          </div>
        )}
      </section>

      {isOwner && (
        <section className="app-card p-5 sm:p-6" aria-labelledby="season-pot-calculation-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="season-pot-calculation-heading" className="text-xl font-semibold">Season pot</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {league.season_pot_auto ? "Updates as season payments are marked paid." : "Using a manual amount."}
              </p>
            </div>
            <strong className="font-display text-3xl font-semibold">{money(league.season_pot_auto ? seasonPotFor(league, rows) : league.season_pot)}</strong>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-faint">Season pot</div>
              <div className="font-display text-lg font-medium">
                {money(league.season_pot_auto ? seasonPotFor(league, rows) : Number(league.season_pot) || 0)}
              </div>
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

          <label className="mt-5 block">
            <span className="field-label">Season Pot entry fee per set ($)</span>
            <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={seasonFee}
                onChange={(event) => setSeasonFee(event.target.value)}
                className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                onClick={() => saveSettings.mutate()}
                disabled={saveSettings.isPending}
                className="self-end"
              >
                {saveSettings.isPending ? "Saving…" : "Save fee"}
              </Button>
            </div>
            <p className="mt-1 text-xs text-faint">This is charged in addition to the weekly entry fee.</p>
          </label>

          <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 border-t border-border pt-4 text-sm font-medium">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={league.season_pot_auto}
              disabled={setAuto.isPending}
              onChange={(event) => setAuto.mutate(event.target.checked)}
            />
            Calculate the Season Pot automatically from paid Season Pot fees
          </label>

          {!league.season_pot_auto && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="field-label">Season pot ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={manualSeason}
                  onChange={(event) => setManualSeason(event.target.value)}
                  className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <Button
                type="button"
                onClick={() => saveManual.mutate()}
                disabled={saveManual.isPending}
                className="self-end"
              >
                {saveManual.isPending ? "Saving…" : "Save season pot"}
              </Button>
            </div>
          )}
        </section>
      )}

      <p className="flex items-center gap-1.5 px-1 text-xs text-faint">
        <Landmark size={13} /> The season pot is held in the league bank and paid out from there.
      </p>
    </div>
  );
}
