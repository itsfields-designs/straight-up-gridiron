import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";

import { createLeague, joinLeague } from "@/lib/leagues.functions";
import { fetchMyLeagues } from "@/lib/pool";

export const Route = createFileRoute("/_authenticated/leagues/")({
  head: () => ({
    meta: [
      { title: "Your leagues — Gridiron Pool" },
      { name: "description", content: "Your NFL pick'em leagues and invites." },
      { property: "og:title", content: "Your leagues — Gridiron Pool" },
      { property: "og:description", content: "Your NFL pick'em leagues and invites." },
    ],
  }),
  component: LeagueHub,
});

const DEFAULT_RULES =
  "Straight-up picks each week. Most correct picks wins. Monday-night total points breaks ties.";

function LeagueHub() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [code, setCode] = useState("");

  const leagues = useQuery({ queryKey: ["leagues"], queryFn: fetchMyLeagues });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_league", {
        _name: name.trim(),
        _rules: rules.trim(),
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      setPanel("none");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
      navigate({ to: "/leagues/$leagueId", params: { leagueId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("join_league_by_code", { _code: code.trim() });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      setPanel("none");
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
      navigate({ to: "/leagues/$leagueId", params: { leagueId: id } });
    },
    onError: (e: Error) => toast.error(e.message.replace(/^.*Exception:?\s*/i, "")),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Your leagues</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Join a league to make weekly picks against friends, or start your own.
      </p>

      {leagues.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}

      {leagues.data?.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border-strong p-8 text-center">
          <Users size={20} className="mx-auto text-faint" />
          <p className="mt-2 text-sm text-muted-foreground">You haven't joined a league yet.</p>
        </div>
      )}

      <div className="mt-6 grid gap-2.5">
        {(leagues.data ?? []).map((l) => (
          <Link
            key={l.id}
            to="/leagues/$leagueId"
            params={{ leagueId: l.id }}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:bg-secondary"
          >
            <div>
              <div className="font-medium">{l.name}</div>
              <div className="text-xs text-faint">Invite code {l.code}</div>
            </div>
            <ChevronRight size={16} className="text-faint" />
          </Link>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => setPanel(panel === "create" ? "none" : "create")}
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85"
        >
          <Plus size={15} /> Create a league
        </button>
        <button
          onClick={() => setPanel(panel === "join" ? "none" : "join")}
          className="rounded-md border border-border-strong bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Join with a code
        </button>
      </div>

      {panel === "create" && (
        <form
          className="mt-5 max-w-md rounded-lg border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="field-label">League name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunday Ticket Degenerates"
            required
            className="mb-4 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="field-label">House rules</label>
          <textarea
            rows={3}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            className="mb-4 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40"
          >
            Create league
          </button>
        </form>
      )}

      {panel === "join" && (
        <form
          className="mt-5 max-w-md rounded-lg border border-border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            join.mutate();
          }}
        >
          <label className="field-label">Invite code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            required
            className="mb-4 w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={join.isPending}
            className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground disabled:opacity-40"
          >
            Join league
          </button>
        </form>
      )}
    </div>
  );
}
