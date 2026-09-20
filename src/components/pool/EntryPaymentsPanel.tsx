import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  autoPots,
  fetchEntryPayments,
  fetchPickEntries,
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
  const [showAllPaid, setShowAllPaid] = useState(false);

  useEffect(() => {
    setManualWeekly(String(league.weekly_pot ?? 0));
  }, [league.weekly_pot]);

  useEffect(() => {
    setExtraSets({});
    setShowAllPaid(false);
  }, [week, league.id]);

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
          seasonPot: Number(league.season_pot) || 0,
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
      const pots = autoPots(rows, league, week);
      await saveLeaguePots({
        leagueId: league.id,
        weeklyPot: on ? pots.weekly : Number(league.weekly_pot) || 0,
        seasonPot: Number(league.season_pot) || 0,
        potsAuto: on,
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
    const message = `Friendly reminder: ${names.join(", ")} — your Week ${week} entry payment of ${money(fee)} per set is still due for ${league.name}.`;
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Payment reminder copied");
    } catch {
      toast.error("Could not copy the reminder");
    }
  };

  return (
    <div className="space-y-4">
      <section className="app-card p-5 sm:p-6" aria-labelledby="entries-summary-heading">
        <h2 id="entries-summary-heading" className="text-2xl font-semibold">Entries</h2>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-5xl font-semibold leading-none">{paidCount}</span>
          <span className="text-lg text-muted-foreground">of {totalSets} paid</span>
        </div>
        <progress
          className="mt-5 h-3 w-full overflow-hidden rounded-full accent-success"
          max={Math.max(totalSets, 1)}
          value={paidCount}
          aria-label={`${paidCount} of ${totalSets} entries paid`}
        />
        <p className="mt-2 text-base text-muted-foreground">
          {money(collectedAmount)} of {money(totalSets * fee)} collected for Week {week}
        </p>
      </section>

      <section className="app-card p-5 sm:p-6" aria-labelledby="paid-heading">
        <h2 id="paid-heading" className="text-2xl font-semibold">Who’s paid</h2>

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
                  aria-label={`Mark ${member.username} set ${entryNo} ${paid ? "unpaid" : "paid"}`}
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
        <section className="app-card p-5 sm:p-6" aria-labelledby="pot-calculation-heading">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="pot-calculation-heading" className="text-xl font-semibold">Week {week} pot</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {league.pots_auto ? "Updates as payments are marked paid." : "Using a manual amount."}
              </p>
            </div>
            <strong className="font-display text-3xl font-semibold">{money(league.pots_auto ? auto.weekly : league.weekly_pot)}</strong>
          </div>

          <label className="mt-5 flex min-h-12 cursor-pointer items-center gap-3 border-t border-border pt-4 text-sm font-medium">
            <input
              type="checkbox"
              className="h-5 w-5 accent-primary"
              checked={league.pots_auto}
              disabled={setAuto.isPending}
              onChange={(event) => setAuto.mutate(event.target.checked)}
            />
            Calculate pot amounts automatically from payments received
          </label>

          {!league.pots_auto && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="field-label">Weekly pot ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={manualWeekly}
                  onChange={(event) => setManualWeekly(event.target.value)}
                  className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <Button
                type="button"
                onClick={() => saveManual.mutate()}
                disabled={saveManual.isPending}
                className="self-end"
              >
                {saveManual.isPending ? "Saving…" : "Save weekly pot"}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
