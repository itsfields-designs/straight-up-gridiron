import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight, Lock, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";

import { createLeague, joinLeague } from "@/lib/leagues.functions";
import { checkMembership, createSznCheckout, SZN_PASS } from "@/lib/membership.functions";
import { fetchMyLeagues } from "@/lib/pool";

export const Route = createFileRoute("/_authenticated/leagues/")({
  head: () => ({
    meta: [
      { title: "Your leagues — Gridiron Gods" },
      { name: "description", content: "Your NFL pick'em leagues and invites." },
      { property: "og:title", content: "Your leagues — Gridiron Gods" },
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
  const createLeagueFn = useServerFn(createLeague);
  const joinLeagueFn = useServerFn(joinLeague);

  const checkMembershipFn = useServerFn(checkMembership);
  const checkoutFn = useServerFn(createSznCheckout);
  const membership = useQuery({ queryKey: ["membership"], queryFn: () => checkMembershipFn() });
  const locked = membership.data ? !membership.data.entitled : false;

  const startCheckout = useMutation({
    mutationFn: async () => await checkoutFn(),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener"),
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () =>
      await createLeagueFn({ data: { name: name.trim(), rules: rules.trim() } }),
    onSuccess: (id) => {
      setPanel("none");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["leagues"] });
      navigate({ to: "/leagues/$leagueId", params: { leagueId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const join = useMutation({
    mutationFn: async () => await joinLeagueFn({ data: { code: code.trim() } }),
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
      <h1 className="text-xl font-semibold sm:text-2xl">Your leagues</h1>
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
            className="flex min-h-[3.5rem] items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5 transition-colors hover:bg-secondary"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{l.name}</div>
              <div className="text-xs text-faint">Invite code {l.code}</div>
            </div>
            <ChevronRight size={16} className="shrink-0 text-faint" />
          </Link>
        ))}
      </div>

      {locked ? (
        <div className="mt-6 rounded-lg border border-accent bg-accent-soft p-5">
          <div className="flex items-center gap-2">
            <Lock size={15} />
            <h2 className="text-sm font-semibold">{SZN_PASS.name} required</h2>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Grab {SZN_PASS.name} for {SZN_PASS.priceLabel} to create or join a league. Your access
            unlocks as soon as payment goes through.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => startCheckout.mutate()}
              disabled={startCheckout.isPending}
              className="min-h-12 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-40"
            >
              Get {SZN_PASS.name}
            </button>
            <button
              onClick={() => membership.refetch()}
              className="min-h-12 rounded-md border border-border-strong bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary"
            >
              I've paid — refresh
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-2 sm:flex sm:flex-wrap">
          <button
            onClick={() => setPanel(panel === "create" ? "none" : "create")}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85"
          >
            <Plus size={15} /> Create a league
          </button>
          <button
            onClick={() => setPanel(panel === "join" ? "none" : "join")}
            className="min-h-12 rounded-md border border-border-strong bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Join with a code
          </button>
        </div>
      )}

      {!locked && panel === "create" && (
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
