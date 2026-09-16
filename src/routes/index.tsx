import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Trophy, ClipboardList, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gridiron Gods — weekly NFL pick'em for your league" },
      {
        name: "description",
        content:
          "Create a league, invite friends with a code, pick every NFL game straight up and watch the standings settle it.",
      },
      { property: "og:title", content: "Gridiron Gods — weekly NFL pick'em for your league" },
      {
        property: "og:description",
        content:
          "Create a league, invite friends with a code, pick every NFL game straight up and watch the standings settle it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/leagues", replace: true });
    });
  }, [navigate]);


  return (
    <main className="min-h-screen">
      <section className="border-b border-primary bg-primary px-5 py-12 text-center text-primary-foreground sm:py-16">
       <div className="mx-auto max-w-3xl">
        <img
          src={logoAsset.url}
          alt="Gridiron Gods"
          className="mx-auto h-28 w-28 rounded-lg object-cover shadow-lg sm:h-32 sm:w-32"
        />
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent-soft-foreground">
          <Trophy size={14} /> 2026 season
        </span>
        <h1 className="mt-6 text-4xl font-semibold uppercase tracking-tight sm:text-6xl">
          Gridiron Gods
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80">
          Pick winners straight up every week. Beat your league. No spreads, no points — just who
          you think wins, with a Monday-night total to break the ties.
        </p>
        <div className="mt-8 grid gap-2.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
          <Link
            to="/auth"
            className="flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-85"
          >
            Start a league
          </Link>
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="flex min-h-12 items-center justify-center rounded-md border border-primary-foreground/40 px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
          >
            Log in
          </Link>
        </div>
       </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-3 px-5 pb-16 sm:grid-cols-3 sm:gap-4 sm:pb-24">
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
            body: "Records update for everyone automatically as official final scores arrive.",
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
