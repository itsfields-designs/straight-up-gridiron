import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ListOrdered, LogOut, Shield, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/leagues", label: "Leagues", short: "Leagues", icon: ListOrdered },
  { to: "/commissioner", label: "Commish", short: "Commish", icon: Shield },
  { to: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: Trophy },
] as const;

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto grid max-w-4xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3.5">
          <Link to="/leagues" className="flex min-w-0 items-center gap-2">
            <img
              src={logoAsset.url}
              alt="Gridiron Gods"
              className="h-8 w-8 shrink-0 rounded-sm object-cover"
            />
            <span className="truncate font-display text-base font-semibold uppercase sm:text-lg">
              Gridiron Gods
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <nav className="hidden items-center gap-3 md:flex">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{ className: "text-foreground font-medium" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <span className="hidden max-w-[14rem] truncate text-muted-foreground lg:inline">
              {user.email}
            </span>
            <button
              onClick={signOut}
              aria-label="Log out"
              className="flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong px-3 text-sm transition-colors hover:bg-secondary"
            >
              <LogOut size={15} /> <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-5 sm:py-7">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.68rem] font-medium text-muted-foreground"
              activeProps={{ className: "text-accent" }}
            >
              <item.icon size={20} />
              {item.short}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
