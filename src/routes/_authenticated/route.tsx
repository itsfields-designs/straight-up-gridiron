import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";

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
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5">
          <Link to="/leagues" className="flex items-center gap-2">
            <img
              src={logoAsset.url}
              alt="Gridiron Gods"
              className="h-8 w-8 rounded-sm object-cover"
            />
            <span className="font-display text-lg font-semibold uppercase">Gridiron Gods</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <nav className="flex items-center gap-3">
              <Link
                to="/dashboard"
                className="text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Dashboard
              </Link>
              <Link
                to="/leagues"
                className="text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Leagues
              </Link>
              <Link
                to="/commissioner"
                className="text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Commish
              </Link>
              <Link
                to="/leaderboard"
                className="text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Leaderboard
              </Link>
            </nav>
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <button

              onClick={signOut}
              className="flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-sm transition-colors hover:bg-secondary"
            >
              <LogOut size={14} /> Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-7">
        <Outlet />
      </main>
    </div>
  );
}
