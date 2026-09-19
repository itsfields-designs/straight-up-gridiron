import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Clock3, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addPayout,
  deletePayout,
  fetchEntryPayments,
  fetchPayouts,
  fetchPickEntries,
  fetchSeasonEntryPayments,
  money,
  commissionerCut,
  commissionerCutPct,
  seasonPotFor,
  seasonPotGross,
  weeklyPotFor,
  weeklyPotGross,
  TOTAL_WEEKS,
  type League,
  type Member,
} from "@/lib/pool";
import { EntryPaymentsPanel } from "@/components/pool/EntryPaymentsPanel";
import { Button } from "@/components/ui/button";

export function PotPanel({
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
  const payouts = useQuery({
    queryKey: ["payouts", league.id],
    queryFn: () => fetchPayouts(league.id),
  });
  const entryPayments = useQuery({
    queryKey: ["entry-payments", league.id],
    queryFn: () => fetchEntryPayments(league.id),
  });
  const seasonEntryPayments = useQuery({
    queryKey: ["season-entry-payments", league.id],
    queryFn: () => fetchSeasonEntryPayments(league.id),
  });
  const pickEntries = useQuery({
    queryKey: ["pick-entries", league.id],
    queryFn: () => fetchPickEntries(league.id),
  });

  const [userId, setUserId] = useState("");
  const [potType, setPotType] = useState<"weekly" | "season">("weekly");
  const [weekNum, setWeekNum] = useState(week);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const rows = payouts.data ?? [];
  const fees = entryPayments.data ?? [];
  const paidWeekly = rows
    .filter((p) => p.potType === "weekly" && p.weekNum === week)
    .reduce((s, p) => s + p.amount, 0);
  const paidSeason = rows.filter((p) => p.potType === "season").reduce((s, p) => s + p.amount, 0);

  const perMember = members.map((m) => ({
    ...m,
    total: rows.filter((p) => p.userId === m.user_id).reduce((s, p) => s + p.amount, 0),
  }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payouts", league.id] });
    queryClient.invalidateQueries({ queryKey: ["cash", league.id] });
    queryClient.invalidateQueries({ queryKey: ["bank", league.id] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!userId) throw new Error("Pick a member to pay");
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter an amount greater than zero");
      await addPayout({
        leagueId: league.id,
        userId,
        createdBy: currentUserId,
        potType,
        weekNum,
        amount: Math.round(n * 100) / 100,
        note: note.trim(),
      });
    },
    onSuccess: () => {
      setAmount("");
      setNote("");
      toast.success("Payout recorded");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deletePayout,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const weeklyGross = weeklyPotGross(league, fees, week);
  const seasonGross = seasonPotGross(league, seasonEntryPayments.data ?? []);
  const cutPct = commissionerCutPct(league);
  const weeklyCut = commissionerCut(league, weeklyGross);
  const seasonCut = commissionerCut(league, seasonGross);
  const currentMember = members.find((member) => member.user_id === currentUserId);
  const myEntries = (pickEntries.data ?? []).filter((e) => e.user_id === currentUserId);
  // Sets the player actually saved for this week, and across the season.
  const weeklySets = Math.max(
    1,
    new Set(myEntries.filter((e) => e.week_num === week).map((e) => e.entry_no)).size,
  );
  const seasonSets = Math.max(1, new Set(myEntries.map((e) => e.entry_no)).size);
  const weeklySetsPaid = new Set(
    fees
      .filter((payment) => payment.userId === currentUserId && payment.weekNum === week)
      .map((payment) => payment.entryNo),
  ).size;
  const seasonSetsPaid = new Set(
    (seasonEntryPayments.data ?? [])
      .filter((payment) => payment.userId === currentUserId)
      .map((payment) => payment.entryNo),
  ).size;

  const cards = [
    { label: "Weekly fee", value: league.entry_fee },
    { label: "Season fee", value: league.season_entry_fee },
    {
      label: `Week ${week} pot`,
      value: weeklyPotFor(league, fees, week),
      sub: cutPct
        ? `${money(paidWeekly)} paid out · ${money(weeklyCut)} commissioner's cut`
        : `${money(paidWeekly)} paid out`,
    },
    {
      label: "Season pot",
      value: seasonPotFor(league, seasonEntryPayments.data ?? []),
      sub: cutPct
        ? `${money(paidSeason)} paid out · ${money(seasonCut)} commissioner's cut`
        : `${money(paidSeason)} paid out`,
    },
  ];

  return (
    <div className="space-y-6">
      {isOwner ? (
        <EntryPaymentsPanel
          league={league}
          members={members}
          isOwner={isOwner}
          currentUserId={currentUserId}
          week={week}
        />
      ) : (
        league.cashapp_handle && (
          <PlayerPayCard
            handle={league.cashapp_handle}
            weeklyFee={Number(league.entry_fee) || 0}
            seasonFee={Number(league.season_entry_fee) || 0}
            week={week}
            username={currentMember?.username ?? "your username"}
            weeklySets={weeklySets}
            seasonSets={seasonSets}
            weeklySetsPaid={weeklySetsPaid}
            seasonSetsPaid={seasonSetsPaid}
          />
        )
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-faint">{c.label}</div>
            <div className="font-display text-lg font-medium">{money(c.value)}</div>
            {c.sub && <div className="mt-0.5 text-xs text-muted-foreground">{c.sub}</div>}
          </div>
        ))}
      </div>

      {isOwner && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Banknote size={15} /> Award pot money
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-faint">Member</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm"
              >
                <option value="">Choose a member…</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.username}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-faint">Pot</span>
              <select
                value={potType}
                onChange={(e) => setPotType(e.target.value as "weekly" | "season")}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm"
              >
                <option value="weekly">Weekly pot</option>
                <option value="season">Season pot</option>
              </select>
            </label>
            {potType === "weekly" && (
              <label className="block">
                <span className="mb-1 block text-xs text-faint">Week</span>
                <select
                  value={weekNum}
                  onChange={(e) => setWeekNum(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm"
                >
                  {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-faint">Amount ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs text-faint">Note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Most correct picks"
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-3 min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {create.isPending ? "Saving…" : "Record payout"}
          </button>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Won per member</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="bg-secondary text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-right font-medium">Total won</th>
              </tr>
            </thead>
            <tbody>
              {perMember.map((m) => (
                <tr key={m.user_id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{m.username}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Payout history</h2>
        <div className="rounded-lg border border-border bg-card">
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-faint">No payouts yet.</p>
          )}
          {rows.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{p.username}</div>
                <div className="truncate text-xs text-faint">
                  {p.potType === "weekly" ? `Weekly pot · Week ${p.weekNum}` : "Season pot"}
                  {p.note ? ` · ${p.note}` : ""} · {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-sm font-medium">{money(p.amount)}</span>
                {isOwner && (
                  <button
                    onClick={() => remove.mutate(p.id)}
                    className="grid min-h-11 min-w-11 place-items-center rounded-md text-destructive hover:bg-destructive-soft"
                    aria-label="Delete payout"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Player-facing card: shows the entry fees due and a button that opens Cash App
 *  pre-filled with the commissioner's handle and the chosen fee amount. */
function PlayerPayCard({
  handle,
  weeklyFee,
  seasonFee,
  week,
  username,
  weeklyPaid,
  seasonPaid,
}: {
  handle: string;
  weeklyFee: number;
  seasonFee: number;
  week: number;
  username: string;
  weeklyPaid: boolean;
  seasonPaid: boolean;
}) {
  const [kind, setKind] = useState<"weekly" | "season">("weekly");
  const amount = kind === "weekly" ? weeklyFee : seasonFee;
  const paid = kind === "weekly" ? weeklyPaid : seasonPaid;
  const cleanHandle = handle.replace(/^\$/, "");
  const cashAppUrl = amount > 0 ? `https://cash.app/$${cleanHandle}/${amount}` : `https://cash.app/$${cleanHandle}`;

  const copyHandle = async () => {
    try {
      await navigator.clipboard.writeText(`$${cleanHandle}`);
      toast.success("Cash App handle copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5" aria-labelledby="your-entry-title">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Clock3 className="shrink-0 text-accent" size={24} aria-hidden="true" />
          <div>
            <h2 id="your-entry-title" className="font-display text-lg font-semibold">Your entry</h2>
            <p className="text-sm text-muted-foreground">Week {week} · {money(weeklyFee)}</p>
          </div>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${paid ? "bg-secondary text-success" : "bg-accent-soft text-accent-foreground"}`}>
          {paid ? "Paid" : "Due"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setKind("weekly")}
          className={`h-auto min-h-28 flex-col items-start whitespace-normal px-4 py-4 text-left shadow-none ${
            kind === "weekly"
              ? "border-accent bg-accent-soft hover:bg-accent-soft"
              : "border-border bg-secondary hover:bg-secondary"
          }`}
        >
          <span className="font-display text-3xl font-semibold text-foreground">{money(weeklyFee)}</span>
          <span className="text-sm font-normal text-muted-foreground">Just this week</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setKind("season")}
          disabled={seasonFee <= 0}
          className={`h-auto min-h-28 flex-col items-start whitespace-normal px-4 py-4 text-left shadow-none ${
            kind === "season"
              ? "border-accent bg-accent-soft hover:bg-accent-soft"
              : "border-border bg-secondary hover:bg-secondary"
          }`}
        >
          <span className="font-display text-3xl font-semibold text-foreground">{money(seasonFee)}</span>
          <span className="text-sm font-normal text-muted-foreground">Whole season</span>
        </Button>
      </div>

      <Button asChild size="lg" className="mt-4 w-full text-base font-semibold">
        <a href={cashAppUrl} target="_blank" rel="noopener noreferrer">
          Pay {money(amount)} on Cash App
        </a>
      </Button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Cash App · ${cleanHandle}</span>
        <Button
          type="button"
          variant="outline"
          onClick={copyHandle}
          className="text-muted-foreground shadow-none"
          aria-label="Copy Cash App handle"
        >
          <Copy aria-hidden="true" /> Copy handle
        </Button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Add your username, <span className="font-medium text-foreground">{username}</span>, in the note so the commish can match your payment.
      </p>
    </section>
  );
}
