import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, LogOut, Shield, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { fetchMyLeagues } from "@/lib/pool";
import { UsernameEditor } from "@/components/UsernameEditor";
import { MembershipCard } from "@/components/MembershipCard";
import { InviteFriends } from "@/components/InviteFriends";

export const Route = createFileRoute("/_authenticated/profile")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Your profile — Gridiron Gods" },
      {
        name: "description",
        content: "Your Gridiron Gods account, SZN Pass, invite link and commissioner tools.",
      },
      { property: "og:title", content: "Your profile — Gridiron Gods" },
      {
        property: "og:description",
        content: "Your Gridiron Gods account, SZN Pass, invite link and commissioner tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const leagues = useQuery({ queryKey: ["leagues"], queryFn: fetchMyLeagues });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/commissioner", label: "Commissioner tools", icon: Shield },
  ] as const;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Profile</h1>
        <p className="mt-1 truncate text-sm text-muted-foreground">{user.email}</p>
      </div>

      <UsernameEditor userId={user.id} />
      <MembershipCard />
      {leagues.data?.[0] ? (
        <InviteFriends leagueCode={leagues.data[0].code} leagueName={leagues.data[0].name} />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex min-h-14 items-center gap-3 border-b border-border px-4 text-sm font-medium last:border-b-0"
          >
            <l.icon size={18} className="text-primary" />
            <span className="flex-1">{l.label}</span>
            <ChevronRight size={16} className="text-faint" />
          </Link>
        ))}
      </div>

      <button
        onClick={signOut}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border-strong bg-card text-sm font-medium"
      >
        <LogOut size={16} /> Log out
      </button>
    </div>
  );
}
