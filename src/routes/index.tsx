import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Trophy, ClipboardList, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
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
      { property: "og:url", content: "https://gridirongods.app/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://gridirongods.app/" }],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [samplePick, setSamplePick] = useState<"Panthers" | "Falcons" | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);


  const features = [
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
  ];

  return (
    <main className="min-h-screen bg-secondary px-0 py-0 sm:px-5 sm:py-8">
      <div className="mx-auto w-full max-w-[720px] overflow-hidden border-border-strong bg-background sm:rounded-[30px] sm:border">
        <section className="bg-primary px-5 pb-8 pt-4 text-primary-foreground sm:px-9 sm:pb-11 sm:pt-6">
          <header className="flex min-h-12 items-center justify-between gap-3">
            <Link to="/" aria-label="Gridiron Gods home" className="flex min-w-0 items-center gap-3">
               <span className="font-display text-xl font-semibold uppercase sm:text-2xl">Gridiron Gods</span>
            </Link>
            <Button asChild variant="outline" className="h-11 shrink-0 rounded-full border-primary-foreground/55 bg-transparent px-5 text-base font-semibold text-primary-foreground shadow-none hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/auth" search={{ mode: "login" }}>Log in</Link>
            </Button>
          </header>

           <div className="mt-5 text-center sm:mt-7">
             <img
               src={logoAsset.url}
               alt="Gridiron Gods"
               className="mx-auto h-48 w-48 object-contain sm:h-56 sm:w-56"
             />
              <h1 className="mx-auto mt-3 max-w-[610px] font-display text-[3.4rem] font-semibold leading-[1.02] sm:text-[4.75rem]">
                Football pick’em for your league.
              </h1>
              <p className="mt-5 font-display text-2xl font-medium text-accent sm:text-3xl">
                Real games. Real bragging rights.
              </p>
             <p className="mx-auto mt-3 max-w-[590px] text-base leading-7 text-primary-foreground/70 sm:text-xl">
              Pick winners straight up. No spreads, no points. A Monday-night total breaks ties.
            </p>
          </div>

           <div className="mt-7 grid gap-3">
             <Button asChild className="h-14 rounded-xl font-display text-xl font-semibold">
               <Link to="/auth">Start a league</Link>
             </Button>
             <Button asChild variant="outline" className="h-14 rounded-xl border-2 border-accent/55 bg-transparent font-display text-lg font-medium text-accent shadow-none hover:bg-accent/10 hover:text-accent">
               <Link to="/auth">I have an invite code</Link>
             </Button>
           </div>
         </section>

         <section className="px-5 pb-10 pt-7 sm:px-8 sm:pb-12 sm:pt-9">
           <h2 className="font-display text-[2rem] font-semibold">Try a pick</h2>
           <div className="mt-3 rounded-xl bg-card p-4 text-card-foreground sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm font-semibold text-muted-foreground">
              <span>Try a pick</span>
              <span>Sun 1:00 PM</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              {[
                { name: "Panthers" as const, abbr: "CAR", badge: "bg-team-panthers" },
                { name: "Falcons" as const, abbr: "ATL", badge: "bg-team-falcons" },
              ].map((team, index) => (
                <div key={team.name} className="contents">
                  {index === 1 && <span className="text-sm font-semibold text-muted-foreground">@</span>}
                  <button
                    type="button"
                    onClick={() => setSamplePick(team.name)}
                    aria-pressed={samplePick === team.name}
                    className={`flex min-h-[70px] min-w-0 items-center gap-2 rounded-xl border-2 px-2 text-left transition-colors sm:px-3 ${
                      samplePick === team.name
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-background hover:border-accent/60"
                    }`}
                  >
                     <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-base font-semibold text-primary-foreground ${team.badge}`}>
                      {team.abbr}
                    </span>
                    <span className="min-w-0 text-[0.95rem] font-semibold sm:text-lg">{team.name}</span>
                     {samplePick === team.name && <Check className="ml-auto shrink-0 text-accent-soft-foreground" size={18} />}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div aria-hidden="true" className="grid min-w-0 flex-1 grid-cols-16 gap-1">
                {Array.from({ length: 16 }).map((_, index) => (
                  <span key={index} className={`h-2 rounded-sm ${samplePick && index === 0 ? "bg-accent" : "bg-border-strong"}`} />
                ))}
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">{samplePick ?? "Tap a team"}</span>
            </div>
           </div>
           <h2 className="mt-8 font-display text-[2rem] font-semibold">How it works</h2>
          <div className="mt-4 divide-y divide-border">
            {features.map((feature) => (
              <div key={feature.title} className="flex gap-4 py-5 first:pt-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                  <feature.icon size={22} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-[1.45rem] font-semibold leading-tight">{feature.title}</h3>
                  <p className="mt-1 text-base leading-6 text-muted-foreground">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already playing?{" "}
            <Link to="/auth" search={{ mode: "login" }} className="font-semibold text-primary underline underline-offset-4">
              Log in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
