import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Copy, Shield, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  fetchCurrentWeek,
  fetchEntryPayments,
  seasonPotFor,
  weeklyPotFor,
  type League,
  type Member,
} from "@/lib/pool";

export function MembersPanel({
  league,
  members,
  isOwner,
  currentUserId,
}: {
  league: League;
  members: Member[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [rules, setRules] = useState(league.rules);
  const [entryFee, setEntryFee] = useState(String(league.entry_fee ?? 0));
  const [weeklyPot, setWeeklyPot] = useState(String(league.weekly_pot ?? 0));
  const [seasonPot, setSeasonPot] = useState(String(league.season_pot ?? 0));

  const entryPayments = useQuery({
    queryKey: ["entry-payments", league.id],
    queryFn: () => fetchEntryPayments(league.id),
  });
  const currentWeek = useQuery({ queryKey: ["current-week"], queryFn: fetchCurrentWeek });
  const shownWeek = currentWeek.data ?? 1;
  const fees = entryPayments.data ?? [];

  const money = (v: number | string) =>
    `$${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const remove = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("league_members")
        .delete()
        .eq("league_id", league.id)
        .eq("user_id", userId);
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      if (userId === currentUserId) {
        queryClient.invalidateQueries({ queryKey: ["leagues"] });
        navigate({ to: "/leagues" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["members", league.id] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRules = useMutation({
    mutationFn: async () => {
      const num = (v: string) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new Error("Amounts must be zero or more");
        return Math.round(n * 100) / 100;
      };
      const { error } = await supabase
        .from("leagues")
        .update({
          rules,
          entry_fee: num(entryFee),
          weekly_pot: num(weeklyPot),
          season_pot: num(seasonPot),
        })
        .eq("id", league.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("League settings updated");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function copyCode() {
    navigator.clipboard?.writeText(league.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <div className="text-xs text-faint">Invite code</div>
          <div className="font-display text-lg font-medium tracking-widest">{league.code}</div>
        </div>
        <button
          onClick={copyCode}
          aria-live="polite"
          className="flex items-center gap-1.5 rounded-md border border-border-strong px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          <Copy size={14} /> {copied ? "Copied" : "Copy code"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Entry fee", value: league.entry_fee },
          { label: `Week ${shownWeek} pot`, value: weeklyPotFor(league, fees, shownWeek) },
          { label: "Season pot", value: seasonPotFor(league, fees) },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-faint">{item.label}</div>
            <div className="font-display text-lg font-medium">{money(item.value ?? 0)}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Members ({members.length})
        </h2>
        <div className="rounded-lg border border-border bg-card">
          {members.map((m, i) => (
            <div
              key={m.user_id}
              className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div>
                <div className="text-sm font-medium">{m.username}</div>
                <div className="text-xs text-faint">
                  {m.user_id === league.owner_id ? "Commissioner" : "Member"}
                </div>
              </div>
              {isOwner && m.user_id !== league.owner_id && (
                <button
                  onClick={() => remove.mutate(m.user_id)}
                  className="flex min-h-11 items-center gap-1 rounded-md px-3 text-sm font-medium text-destructive hover:bg-destructive-soft"
                  aria-label={`Remove ${m.username} from league`}
                >
                  <X size={13} /> Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {isOwner ? (
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Shield size={14} /> Commissioner settings
          </h2>
          <label className="field-label" htmlFor="league-house-rules">House rules</label>
          <textarea
            id="league-house-rules"
            rows={3}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Entry fee", value: entryFee, set: setEntryFee },
              { label: "Weekly pot", value: weeklyPot, set: setWeeklyPot },
              { label: "Season pot", value: seasonPot, set: setSeasonPot },
            ].map((f) => (
              <label key={f.label} className="block">
                <span className="mb-1 block text-xs text-faint">{f.label} ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
          </div>
          <button
            onClick={() => saveRules.mutate()}
            disabled={saveRules.isPending}
            className="mt-3 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {saveRules.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      ) : (
        <button
          onClick={() => remove.mutate(currentUserId)}
          className="rounded-md bg-destructive-soft px-4 py-2.5 text-sm font-medium text-destructive"
        >
          Leave league
        </button>
      )}
    </div>
  );
}
