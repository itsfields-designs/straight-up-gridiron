import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { fetchWeek, type Game } from "@/lib/pool";

type DraftGame = { id: string; away: string; home: string; slot: string };

function newId() {
  return "g_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function SchedulePanel({ week }: { week: number }) {
  const queryClient = useQueryClient();
  const weekQuery = useQuery({ queryKey: ["week", week], queryFn: () => fetchWeek(week) });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftGame[]>([]);
  const [scores, setScores] = useState<Record<string, { away: string; home: string }>>({});
  const [locked, setLocked] = useState(false);

  const games = weekQuery.data?.games ?? [];
  const weekData = weekQuery.data?.week ?? null;

  useEffect(() => {
    setDraft(
      games.length
        ? games.map((g) => ({ id: g.id, away: g.away, home: g.home, slot: g.slot }))
        : [{ id: newId(), away: "", home: "", slot: "" }],
    );
    setScores(
      Object.fromEntries(
        games.map((g: Game) => [
          g.id,
          { away: g.away_score?.toString() ?? "", home: g.home_score?.toString() ?? "" },
        ]),
      ),
    );
    setLocked(!!weekData?.locked);
    setEditing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekQuery.dataUpdatedAt, week]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["week", week] });
    queryClient.invalidateQueries({ queryKey: ["all-weeks"] });
  };

  const saveSchedule = useMutation({
    mutationFn: async () => {
      const clean = draft.filter((g) => g.away.trim() && g.home.trim());
      if (!clean.length) throw new Error("Add at least one matchup.");
      const tiebreaker = clean[clean.length - 1]!.id;

      const { error: we } = await supabase
        .from("weeks")
        .upsert(
          { week_num: week, label: `Week ${week}`, tiebreaker_game_id: tiebreaker, locked },
          { onConflict: "week_num" },
        );
      if (we) throw we;

      const keepIds = clean.map((g) => g.id);
      const removed = games.filter((g) => !keepIds.includes(g.id)).map((g) => g.id);
      if (removed.length) {
        const { error } = await supabase.from("games").delete().in("id", removed);
        if (error) throw error;
      }

      const { error } = await supabase.from("games").upsert(
        clean.map((g, i) => ({
          id: g.id,
          week_num: week,
          away: g.away.trim(),
          home: g.home.trim(),
          slot: g.slot.trim(),
          sort_order: i + 1,
        })),
        { onConflict: "id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule saved");
      setEditing(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveScores = useMutation({
    mutationFn: async () => {
      for (const game of games) {
        const s = scores[game.id] ?? { away: "", home: "" };
        const { error } = await supabase
          .from("games")
          .update({
            away_score: s.away === "" ? null : Number(s.away),
            home_score: s.home === "" ? null : Number(s.home),
          })
          .eq("id", game.id);
        if (error) throw error;
      }
      const { error } = await supabase.from("weeks").update({ locked }).eq("week_num", week);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Results saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (weekQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 rounded-lg bg-accent-soft p-3.5 text-sm text-accent-soft-foreground">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <span>
          Matchups and final scores are entered here — any league member can keep them current for
          everyone, using the official NFL schedule as the source of truth. Week 1's real matchups
          are pre-loaded.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Week {week} matchups</h2>
        <button
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
        >
          {editing ? "Cancel" : "Edit matchups"}
        </button>
      </div>

      {editing ? (
        <div className="space-y-2">
          {draft.map((g, i) => (
            <div key={g.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              {(["away", "home", "slot"] as const).map((field) => (
                <input
                  key={field}
                  value={g[field]}
                  placeholder={
                    field === "away" ? "Away team" : field === "home" ? "Home team" : "Day / time"
                  }
                  onChange={(e) =>
                    setDraft((gs) =>
                      gs.map((row, idx) =>
                        idx === i ? { ...row, [field]: e.target.value } : row,
                      ),
                    )
                  }
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              ))}
              <button
                onClick={() => setDraft((gs) => gs.filter((_, idx) => idx !== i))}
                className="text-destructive"
                aria-label="Remove game"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setDraft((gs) => [...gs, { id: newId(), away: "", home: "", slot: "" }])}
              className="flex items-center gap-1 rounded-md border border-border-strong px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Plus size={14} /> Add game
            </button>
            <button
              onClick={() => saveSchedule.mutate()}
              disabled={saveSchedule.isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-40"
            >
              Save schedule
            </button>
          </div>
          <p className="text-xs text-faint">
            The last game listed is used as the tiebreaker (total combined points).
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          {games.map((g, i) => (
            <div
              key={g.id}
              className={`flex flex-wrap items-center justify-between gap-1 px-4 py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div>
                <span className="font-medium">{g.away}</span>
                <span className="text-faint"> @ </span>
                <span className="font-medium">{g.home}</span>
                {g.id === weekData?.tiebreaker_game_id && (
                  <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-soft-foreground">
                    tiebreaker
                  </span>
                )}
              </div>
              <span className="text-xs text-faint">{g.slot}</span>
            </div>
          ))}
          {!games.length && (
            <div className="px-4 py-6 text-center text-sm text-faint">No matchups entered yet.</div>
          )}
        </div>
      )}

      {games.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Final scores</h2>
          <div className="rounded-lg border border-border bg-card">
            {games.map((g, i) => (
              <div
                key={g.id}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}
              >
                <div>
                  {g.away} <span className="text-faint">@</span> {g.home}
                </div>
                {(["away", "home"] as const).map((side) => (
                  <input
                    key={side}
                    type="number"
                    aria-label={`${side === "away" ? g.away : g.home} score`}
                    value={scores[g.id]?.[side] ?? ""}
                    onChange={(e) =>
                      setScores((s) => ({
                        ...s,
                        [g.id]: {
                          away: s[g.id]?.away ?? "",
                          home: s[g.id]?.home ?? "",
                          [side]: e.target.value,
                        },
                      }))
                    }
                    className="w-16 rounded-md border border-input bg-card px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
              />
              Lock picks for this week (prevents further changes)
            </label>
            <button
              onClick={() => saveScores.mutate()}
              disabled={saveScores.isPending}
              className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40"
            >
              Save scores
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
