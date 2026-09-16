import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addBankDeposit,
  bankSummary,
  deleteBankDeposit,
  fetchBankDeposits,
  fetchCashTxns,
  fetchPayouts,
  money,
  type League,
} from "@/lib/pool";

export function BankPanel({
  league,
  isOwner,
  currentUserId,
}: {
  league: League;
  isOwner: boolean;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const deposits = useQuery({
    queryKey: ["bank", league.id],
    queryFn: () => fetchBankDeposits(league.id),
  });
  const txns = useQuery({ queryKey: ["cash", league.id], queryFn: () => fetchCashTxns(league.id) });
  const payouts = useQuery({
    queryKey: ["payouts", league.id],
    queryFn: () => fetchPayouts(league.id),
  });

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const bankDeposits = deposits.data ?? [];
  const summary = bankSummary(bankDeposits, txns.data ?? [], payouts.data ?? []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bank", league.id] });
    queryClient.invalidateQueries({ queryKey: ["cash", league.id] });
    queryClient.invalidateQueries({ queryKey: ["payouts", league.id] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Enter an amount greater than zero");
      await addBankDeposit({
        leagueId: league.id,
        createdBy: currentUserId,
        amount: Math.round(n * 100) / 100,
        note: note.trim(),
      });
    },
    onSuccess: () => {
      setAmount("");
      setNote("");
      toast.success("Deposit added to the league bank");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteBankDeposit,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const cards = [
    { label: "In the league bank", value: summary.balance, strong: true },
    { label: "Season pot held", value: Number(league.season_pot) || 0 },
    { label: "Deposits in", value: summary.commissioner + summary.memberDeposits },
    { label: "Paid out", value: summary.paid + summary.withdrawals },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-faint">{c.label}</div>
            <div
              className={`font-display font-medium ${c.strong ? "text-2xl" : "text-lg"} ${
                c.strong && summary.balance <= 0 ? "text-destructive" : ""
              }`}
            >
              {money(c.value)}
            </div>
          </div>
        ))}
      </div>

      <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
        The league bank holds the season pot: every entry fee the commissioner ticks off adds its
        season share here automatically. Every payout and member withdrawal comes out of this
        balance, and payments are blocked if the bank doesn't hold enough.
      </p>


      {isOwner && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Landmark size={15} /> Deposit into the league bank
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                placeholder="Season kitty top-up"
                className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-3 min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {create.isPending ? "Saving…" : "Add deposit"}
          </button>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Bank deposits</h2>
        <div className="rounded-lg border border-border bg-card">
          {bankDeposits.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-faint">
              The commissioner hasn't deposited anything yet.
            </p>
          )}
          {bankDeposits.map((d, i) => (
            <div
              key={d.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{d.createdByName}</div>
                <div className="truncate text-xs text-faint">
                  {d.note ? `${d.note} · ` : ""}
                  {new Date(d.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="tabular-nums text-sm font-medium">+{money(d.amount)}</span>
                {isOwner && (
                  <button
                    onClick={() => remove.mutate(d.id)}
                    className="grid min-h-11 min-w-11 place-items-center rounded-md text-destructive hover:bg-destructive-soft"
                    aria-label="Delete deposit"
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
