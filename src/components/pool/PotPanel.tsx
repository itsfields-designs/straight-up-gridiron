import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addPayout,
  deletePayout,
  fetchPayouts,
  money,
  TOTAL_WEEKS,
  type League,
  type Member,
} from "@/lib/pool";

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

  const [userId, setUserId] = useState("");
  const [potType, setPotType] = useState<"weekly" | "season">("weekly");
  const [weekNum, setWeekNum] = useState(week);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const rows = payouts.data ?? [];
  const paidWeekly = rows.filter((p) => p.potType === "weekly").reduce((s, p) => s + p.amount, 0);
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

  const cards = [
    { label: "Entry fee", value: league.entry_fee },
    { label: "Weekly pot", value: league.weekly_pot, sub: `${money(paidWeekly)} paid out` },
    { label: "Season pot", value: league.season_pot, sub: `${money(paidSeason)} paid out` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="mt-3 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {create.isPending ? "Saving…" : "Record payout"}
          </button>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Won per member</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
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
                    className="text-destructive"
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
