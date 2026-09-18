import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, ClipboardList, Trophy, Banknote } from "lucide-react";

const TITLE = "Office football pool — run yours on Gridiron Gods";
const DESCRIPTION =
  "Run your office football pool online: invite coworkers with a code, pick every NFL game straight up, and let scores and standings update automatically each week.";

export const Route = createFileRoute("/office-football-pool")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: "https://gridirongods.app/office-football-pool" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://gridirongods.app/office-football-pool" }],
  }),
  component: OfficePoolPage,
});

const STEPS = [
  {
    icon: Users,
    title: "Invite the office with one code",
    body: "Create a league and share its six-character code. Coworkers join in seconds — no spreadsheet, no chasing people over email.",
  },
  {
    icon: ClipboardList,
    title: "Everyone picks straight up",
    body: "Each week, players tap a winner for every NFL game and add a Monday-night tiebreaker total. Picks lock at kickoff, so nobody sneaks one in late.",
  },
  {
    icon: Trophy,
    title: "Scores and standings update themselves",
    body: "Real NFL results come in automatically, so weekly records and season standings are always current without anyone tallying them by hand.",
  },
  {
    icon: Banknote,
    title: "Track entry fees and payouts",
    body: "The organizer marks who has paid each week, and weekly and season pots are calculated for you, with payouts recorded per person.",
  },
];

function OfficePoolPage() {
  return (
    <main className="min-h-screen">
      <section className="border-b border-primary bg-primary px-5 py-12 text-center text-primary-foreground sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-semibold uppercase tracking-tight sm:text-5xl">
            Office football pool, run the easy way
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-primary-foreground/80">
            {DESCRIPTION}
          </p>
          <div className="mt-8 grid gap-2.5 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
            <Link
              to="/auth"
              className="flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-85"
            >
              Start your office pool
            </Link>
            <Link
              to="/"
              className="flex min-h-12 items-center justify-center rounded-md border border-primary-foreground/40 px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/10"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-3 px-5 py-8 sm:grid-cols-2 sm:gap-4 sm:py-12">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-lg border border-border bg-card p-5">
            <s.icon size={18} className="text-accent" />
            <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-14">
        <h2 className="text-xl font-semibold">Why coworkers stick with it</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Straight-up picks keep the rules simple enough for people who never watch football, while
          the weekly and season standings give everyone a reason to check in on Monday morning.
          Players can enter more than one set of picks, chat with the group in the league, and see
          exactly where the money stands at any point in the season.
        </p>
        <Link
          to="/auth"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-85"
        >
          Create your league
        </Link>
      </section>
    </main>
  );
}
