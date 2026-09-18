import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Shield, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { InviteFriends } from "@/components/InviteFriends";
import {
  fetchCurrentWeek,
  fetchEntryPayments,
  fetchSeasonEntryPayments,
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
  const [rules, setRules] = useState(league.rules);
  const [entryFee, setEntryFee] = useState(String(league.entry_fee ?? 0));
  const [seasonEntryFee, setSeasonEntryFee] = useState(String(league.season_entry_fee ?? 0));
  const [weeklyPot, setWeeklyPot] = useState(String(league.weekly_pot ?? 0));
  const [seasonPot, setSeasonPot] = useState(String(league.season_pot ?? 0));
  const [sundayOnly, setSundayOnly] = useState(Boolean(league.sunday_only));
  const [cutOn, setCutOn] = useState(Boolean(league.commissioner_cut_enabled));
  const [cutPct, setCutPct] = useState(String(league.commissioner_cut_pct ?? 0));
  const [cashapp, setCashapp] = useState(league.cashapp_handle ?? "");

  const entryPayments = useQuery({
    queryKey: ["entry-payments", league.id],
    queryFn: () => fetchEntryPayments(league.id),
  });
  const currentWeek = useQuery({ queryKey: ["current-week"], queryFn: fetchCurrentWeek });
  const seasonEntryPayments = useQuery({
    queryKey: ["season-entry-payments", league.id],
    queryFn: () => fetchSeasonEntryPayments(league.id),
  });
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

  function confirmRemoval(userId: string, username: string) {
    if (!window.confirm(`Remove ${username} from ${league.name}? Their league access will end.`)) {
      return;
    }
    remove.mutate(userId);
  }

  const saveRules = useMutation({
    mutationFn: async () => {
      const num = (v: string) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new Error("Amounts must be zero or more");
        return Math.round(n * 100) / 100;
      };
      const changedSunday = sundayOnly !== Boolean(league.sunday_only);
      const pct = Number(cutPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100)
        throw new Error("Commissioner's Cut must be between 0 and 100");
      const { error } = await supabase
        .from("leagues")
        .update({
          rules,
          entry_fee: num(entryFee),
          season_entry_fee: num(seasonEntryFee),
          weekly_pot: num(weeklyPot),
          season_pot: num(seasonPot),
          sunday_only: sundayOnly,
          commissioner_cut_enabled: cutOn,
          commissioner_cut_pct: Math.round(pct * 100) / 100,
          cashapp_handle: cashapp.trim().replace(/^\$/, ""),
          // Applies from the week it is changed, so finished weeks keep their records.
          ...(changedSunday ? { sunday_only_from_week: shownWeek } : {}),
        })
        .eq("id", league.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("League settings updated");
      queryClient.invalidateQueries({ queryKey: ["league", league.id] });
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
      queryClient.invalidateQueries({ queryKey: ["week"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <InviteFriends leagueCode={league.code} leagueName={league.name} />


      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: "Weekly fee", value: league.entry_fee },
          { label: "Season fee", value: league.season_entry_fee },
          { label: `Week ${shownWeek} pot`, value: weeklyPotFor(league, fees, shownWeek) },
          { label: "Season pot", value: seasonPotFor(league, seasonEntryPayments.data ?? []) },
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
                  type="button"
                  onClick={() => confirmRemoval(m.user_id, m.username)}
                  disabled={remove.isPending}
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
            className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
           <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: "Entry fee", value: entryFee, set: setEntryFee },
               { label: "Season entry fee", value: seasonEntryFee, set: setSeasonEntryFee },
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
                  className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-faint">Cash App handle (for member payments)</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-faint">$</span>
              <input
                type="text"
                inputMode="latin-name"
                value={cashapp}
                onChange={(e) => setCashapp(e.target.value)}
                placeholder="thehoodinvestor"
                className="min-h-11 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <span className="mt-1 block text-xs text-faint">
              Members see a "Pay in Cash App" button that opens Cash App to this handle with the entry fee filled in.
            </span>
          </label>

          <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-card p-3.5">
            <input
              type="checkbox"
              checked={sundayOnly}
              onChange={(e) => setSundayOnly(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-input accent-[var(--accent)]"
            />
            <span className="text-sm">
              <span className="font-medium">Sunday and Monday games only</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Thursday, Friday and Saturday games are left off the pick sheet and never count
                toward records. Picks stay open until the first Sunday kickoff. Changing this takes
                effect from Week {shownWeek} onward — finished weeks keep their results.
                {league.sunday_only && (
                  <> Currently active from Week {league.sunday_only_from_week}.</>
                )}
              </span>
            </span>
          </label>

          <div className="mt-4 rounded-lg border border-border bg-card p-3.5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={cutOn}
                onChange={(e) => setCutOn(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-input accent-[var(--accent)]"
              />
              <span className="text-sm">
                <span className="font-medium">Commissioner's Cut</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Takes a set percentage off the weekly and season pots before payouts. Everyone in
                  the league sees the reduced pot amounts.
                </span>
              </span>
            </label>
            {cutOn && (
              <label className="mt-3 block">
                <span className="mb-1 block text-xs text-faint">Commissioner's Cut (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  inputMode="decimal"
                  value={cutPct}
                  onChange={(e) => setCutPct(e.target.value)}
                  className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-40"
                />
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={() => saveRules.mutate()}
            disabled={saveRules.isPending}
            className="mt-3 min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            {saveRules.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => remove.mutate(currentUserId)}
          className="min-h-11 rounded-md bg-destructive-soft px-4 text-sm font-medium text-destructive"
        >
          Leave league
        </button>
      )}
    </div>
  );
}
