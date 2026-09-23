import { createFileRoute, Outlet, redirect, Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, Home, ListOrdered, Swords, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { countPendingDuelChallenges } from "@/lib/duels.functions";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  staticData: { sitemap: "exclude-subtree" },
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/leagues", label: "Leagues", icon: ListOrdered },
  { to: "/college", label: "College", icon: GraduationCap },
  { to: "/duels", label: "Duels", icon: Swords },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const { pathname } = useLocation();
  const isDuels = pathname === "/duels";
  const initials = (user.email ?? "?").slice(0, 2).toUpperCase();

  // Pending head-to-head challenges waiting on this player.
  const loadPending = useServerFn(countPendingDuelChallenges);
  const pending = useQuery({
    queryKey: ["duel-pending"],
    queryFn: () => loadPending(),
    refetchInterval: 60_000,
  });
  const pendingCount = pending.data?.pending ?? 0;

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {!isDuels && (
        <header className="sticky top-0 z-30 border-b border-accent/50 bg-primary text-primary-foreground">
          <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-3 px-4 py-2.5">
            <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
              <img
                src={logoAsset.url}
                alt="Gridiron Gods"
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
              <span className="truncate font-display text-xl font-semibold uppercase">
                Gridiron Gods
              </span>
            </Link>
            <Link
              to="/profile"
              aria-label="Your profile"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-accent/70 bg-primary text-sm font-semibold"
            >
              {initials}
            </Link>
          </div>
        </header>
      )}

      <main className={`mx-auto max-w-3xl px-4 ${isDuels ? "py-0" : "py-5 sm:py-7"}`}>
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-accent/35 bg-primary text-primary-foreground pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {NAV.map((item) => {
            const badge = item.to === "/duels" ? pendingCount : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-[4.5rem] flex-col items-center justify-center gap-1 text-xs font-medium text-primary-foreground/55"
                activeProps={{ className: "text-accent font-semibold" }}
              >
                <span className="relative">
                  <item.icon size={22} />
                  {badge > 0 && (
                    <span
                      aria-label={`${badge} pending duel challenges`}
                      className="absolute -right-2.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 text-[0.65rem] font-bold leading-5 text-destructive-foreground"
                    >
                      {badge}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
