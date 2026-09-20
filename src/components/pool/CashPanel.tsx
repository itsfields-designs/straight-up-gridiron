import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  cashBalances,
  collected,
  deleteCashTxn,
  entryFeeDeposits,
  fetchCashTxns,
  fetchEntryPayments,
  fetchPayouts,
  fetchStandings,
  fetchSeasonEntryPayments,
  money,
  seasonEntryFeeDeposits,
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
  const seasonEntryPayments = useQuery({
    queryKey: ["season-entry-payments", league.id],
    queryFn: () => fetchSeasonEntryPayments(league.id),
  });


  const [kind, setKind] = useState<"deposit" | "withdrawal">("deposit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const allTxns = txns.data ?? [];
  const allPayouts = payouts.data ?? [];
  const allEntryPayments = entryPayments.data ?? [];
  const fee = Number(league.entry_fee) || 0;
  const feePaid = entryFeeDeposits(allEntryPayments, fee);
  const allSeasonPayments = seasonEntryPayments.data ?? [];
  const seasonFeePaid = seasonEntryFeeDeposits(
    allSeasonPayments,
    Number(league.season_entry_fee) || 0,
  );
  const rawBalances = cashBalances(allTxns, allPayouts);
  const balances = new Map(
    members.map((m) => {
      const b = rawBalances.get(m.user_id) ?? { deposited: 0, withdrawn: 0, won: 0 };
      return [m.user_id, {
        ...b,
        deposited:
          b.deposited +
          (feePaid.get(m.user_id) ?? 0) +
          (seasonFeePaid.get(m.user_id) ?? 0),
      }];
    }),
  );
  for (const [id, b] of rawBalances) {
    if (!balances.has(id)) {
      balances.set(id, {
        ...b,
        deposited: b.deposited + (feePaid.get(id) ?? 0) + (seasonFeePaid.get(id) ?? 0),
      });
    }
  }
  const rankOf = new Map((standings.data ?? []).map((s) => [s.userId, s]));
  const nameOf = new Map(members.map((m) => [m.user_id, m.username]));



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
  const seasonFees = allSeasonPayments.reduce(
    (sum, payment) =>
      sum +
      (payment.amount > 0 ? payment.amount : Number(league.season_entry_fee) || 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
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
          <div className="text-xs text-faint">Weekly fees collected</div>
          <div className="font-display text-lg font-medium">{money(fees.season)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-faint">Weekly fee</div>
          <div className="font-display text-lg font-medium">{money(league.entry_fee)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-faint">Season fees collected</div>
          <div className="font-display text-lg font-medium">{money(seasonFees)}</div>
        </div>
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
          {allTxns.length === 0 && allPayouts.length === 0 && allEntryPayments.length === 0 && allSeasonPayments.length === 0 && (
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

          {allSeasonPayments
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border-t border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {nameOf.get(p.userId) ?? "Unknown player"}
                    {p.entryNo > 1 ? ` #${p.entryNo}` : ""}
                  </div>
                  <div className="truncate text-xs text-faint">
                    Season Pot entry fee · {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="tabular-nums text-sm font-medium">
                  +{money(p.amount > 0 ? p.amount : league.season_entry_fee)}
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
                    className="grid min-h-11 min-w-11 place-items-center rounded-md text-destructive hover:bg-destructive-soft"
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
