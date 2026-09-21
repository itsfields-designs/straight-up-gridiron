import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { GraduationCap, Home, ListOrdered, Swords, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
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
  const initials = (user.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link to="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
            <img
              src={logoAsset.url}
              alt="Gridiron Gods"
              className="h-9 w-9 shrink-0 rounded-md object-cover"
            />
            <span className="truncate font-display text-lg font-semibold uppercase tracking-wide">
              Gridiron Gods
            </span>
          </Link>
          <Link
            to="/profile"
            aria-label="Your profile"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary-foreground/40 text-sm font-semibold"
          >
            {initials}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 sm:py-6">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-[4rem] flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
              activeProps={{ className: "text-primary font-semibold" }}
            >
              <item.icon size={22} />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
