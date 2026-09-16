import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addCashTxn,
  cashBalances,
  collected,
  deleteCashTxn,
  entryFeeDeposits,
  fetchCashTxns,
  fetchEntryPayments,
  fetchPayouts,
  fetchStandings,
  money,
  type League,
  type Member,
} from "@/lib/pool";



export function CashPanel({
  league,
  members,
  currentUserId,
}: {
  league: League;
  members: Member[];
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const txns = useQuery({ queryKey: ["cash", league.id], queryFn: () => fetchCashTxns(league.id) });
  const payouts = useQuery({
    queryKey: ["payouts", league.id],
    queryFn: () => fetchPayouts(league.id),
  });
  const standings = useQuery({
    queryKey: ["standings", league.id, 0],
    queryFn: () => fetchStandings(league.id, 0),
  });
  const entryPayments = useQuery({
    queryKey: ["entry-payments", league.id],
    queryFn: () => fetchEntryPayments(league.id),
  });


  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const allTxns = txns.data ?? [];
  const allPayouts = payouts.data ?? [];
  const allEntryPayments = entryPayments.data ?? [];
  const fee = Number(league.entry_fee) || 0;
  const feePaid = entryFeeDeposits(allEntryPayments, fee);
  const rawBalances = cashBalances(allTxns, allPayouts);
  const balances = new Map(
    members.map((m) => {
      const b = rawBalances.get(m.user_id) ?? { deposited: 0, withdrawn: 0, won: 0 };
      return [m.user_id, { ...b, deposited: b.deposited + (feePaid.get(m.user_id) ?? 0) }];
    }),
  );
  for (const [id, b] of rawBalances) {
    if (!balances.has(id)) balances.set(id, { ...b, deposited: b.deposited + (feePaid.get(id) ?? 0) });
  }
  const rankOf = new Map((standings.data ?? []).map((s) => [s.userId, s]));


  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cash", league.id] });
    queryClient.invalidateQueries({ queryKey: ["bank", league.id] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter an amount greater than zero");
      await addCashTxn({
        leagueId: league.id,
        userId: currentUserId,
        kind,
        amount: Math.round(n * 100) / 100,
        note: note.trim(),
      });
    },
    onSuccess: () => {
      setAmount("");
      setNote("");
      toast.success(kind === "deposit" ? "Deposit added" : "Withdrawal added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteCashTxn,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const mine = balances.get(currentUserId) ?? { deposited: 0, withdrawn: 0, won: 0 };
  const myBalance = mine.deposited + mine.won - mine.withdrawn;
  const poolTotal = Array.from(balances.values()).reduce(
    (s, b) => s + b.deposited - b.withdrawn,
    0,
  );
  const fees = collected(entryPayments.data ?? [], 0, Number(league.entry_fee) || 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-faint">Your balance</div>
          <div className="font-display text-lg font-medium">{money(myBalance)}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {money(mine.deposited)} in · {money(mine.won)} won · {money(mine.withdrawn)} out
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-faint">Cash in the pool</div>
          <div className="font-display text-lg font-medium">{money(poolTotal)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-faint">Entry fees collected</div>
          <div className="font-display text-lg font-medium">{money(fees.season)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-faint">Entry fee</div>
          <div className="font-display text-lg font-medium">{money(league.entry_fee)}</div>
        </div>
      </div>


      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Add money movement</h2>
        <div className="flex w-fit gap-1 rounded-md bg-secondary p-1">
          {(["deposit", "withdrawal"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex items-center gap-1.5 rounded px-3.5 py-1.5 text-sm font-medium ${
                kind === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {k === "deposit" ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
              {k === "deposit" ? "Deposit" : "Withdraw"}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <label className="block">
            <span className="mb-1 block text-xs text-faint">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Venmo to commissioner"
              className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="mt-3 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
        >
          {create.isPending ? "Saving…" : kind === "deposit" ? "Add deposit" : "Add withdrawal"}
        </button>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Balances and season standing
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[26rem] text-sm">
            <thead>
              <tr className="bg-secondary text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Member</th>
                <th className="px-4 py-2.5 text-right font-medium">Record</th>
                <th className="px-4 py-2.5 text-right font-medium">Won</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const b = balances.get(m.user_id) ?? { deposited: 0, withdrawn: 0, won: 0 };
                const s = rankOf.get(m.user_id);
                return (
                  <tr key={m.user_id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium">
                      {s ? `#${s.rank} ` : ""}
                      {m.username}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {s ? `${s.correct}-${s.missed}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(b.won)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {money(b.deposited + b.won - b.withdrawn)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">History</h2>
        <div className="rounded-lg border border-border bg-card">
          {allTxns.length === 0 && allPayouts.length === 0 && allEntryPayments.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-faint">Nothing recorded yet.</p>
          )}
          {allEntryPayments
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {nameOf.get(p.userId) ?? "Unknown player"}
                    {p.entryNo > 1 ? ` #${p.entryNo}` : ""}
                  </div>
                  <div className="truncate text-xs text-faint">
                    Entry fee · Week {p.weekNum} · {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="tabular-nums text-sm font-medium">
                  +{money(p.amount > 0 ? p.amount : fee)}
                </span>
              </div>
            ))}

          {allTxns.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${i > 0 || allEntryPayments.length > 0 ? "border-t border-border" : ""}`}

            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{t.username}</div>
                <div className="truncate text-xs text-faint">
                  {t.kind === "deposit" ? "Deposit" : "Withdrawal"}
                  {t.note ? ` · ${t.note}` : ""} · {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-sm font-medium">
                  {t.kind === "deposit" ? "+" : "−"}
                  {money(t.amount)}
                </span>
                {t.userId === currentUserId && (
                  <button
                    onClick={() => remove.mutate(t.id)}
                    className="text-destructive"
                    aria-label="Delete entry"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {allPayouts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 border-t border-border px-4 py-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{p.username}</div>
                <div className="truncate text-xs text-faint">
                  Payout · {p.potType === "weekly" ? `Week ${p.weekNum}` : "Season"} ·{" "}
                  {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span className="tabular-nums text-sm font-medium text-accent-soft-foreground">
                +{money(p.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
