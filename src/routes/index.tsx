import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, ClipboardList, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gridiron Pool — weekly NFL pick'em for your league" },
      {
        name: "description",
        content:
          "Create a league, invite friends with a code, pick every NFL game straight up and watch the standings settle it.",
      },
      { property: "og:title", content: "Gridiron Pool — weekly NFL pick'em for your league" },
      {
        property: "og:description",
        content:
          "Create a league, invite friends with a code, pick every NFL game straight up and watch the standings settle it.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/leagues", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground">
          <Trophy size={14} /> 2026 season
        </span>
        <h1 className="mt-6 text-5xl font-semibold uppercase tracking-tight sm:text-6xl">
          Gridiron Pool
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Pick winners straight up every week. Beat your league. No spreads, no points — just who
          you think wins, with a Monday-night total to break the ties.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-85"
          >
            Start a league
          </Link>
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="rounded-md border border-border-strong bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-5 pb-24 sm:grid-cols-3">
        {[
          {
            icon: Users,
            title: "Invite with a code",
            body: "Every league gets a six-character code. Share it and your friends are in.",
          },
          {
            icon: ClipboardList,
            title: "Pick all 16 games",
            body: "Tap a team per matchup, add your tiebreaker total, done in a minute.",
          },
          {
            icon: Trophy,
            title: "Weekly and season standings",
            body: "Records update for everyone as final scores get entered.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-lg border border-border bg-card p-5">
            <f.icon size={18} className="text-accent" />
            <h2 className="mt-3 text-lg font-semibold">{f.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
