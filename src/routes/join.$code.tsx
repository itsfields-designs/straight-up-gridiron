import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { attachInvite } from "@/lib/referrals.functions";
import { joinLeague } from "@/lib/leagues.functions";
import { checkMembership, createSznCheckout, SZN_PASS } from "@/lib/membership.functions";
import { clearInvite, rememberInvite } from "@/lib/invite";
import logoAsset from "@/assets/gridiron-gods-logo.png.asset.json";

export const Route = createFileRoute("/join/$code")({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { ref?: string } =>
    typeof search["ref"] === "string" ? { ref: search["ref"] } : {},
  head: () => ({
    meta: [
      { title: "Join a league — Gridiron Gods" },
      {
        name: "description",
        content: "Accept your invite and start making weekly NFL picks with your friends.",
      },
      { property: "og:title", content: "Join a league — Gridiron Gods" },
      {
        property: "og:description",
        content: "Accept your invite and start making weekly NFL picks with your friends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const { code } = Route.useParams();
  const { ref } = Route.useSearch();
  const navigate = useNavigate();
  const attach = useServerFn(attachInvite);
  const join = useServerFn(joinLeague);
  const check = useServerFn(checkMembership);
  const checkout = useServerFn(createSznCheckout);

  const [state, setState] = useState<"working" | "paywall" | "error">("working");
  const [message, setMessage] = useState("Checking your invite…");
  const [busy, setBusy] = useState(false);

  const leagueCode = code.trim().toUpperCase();

  useEffect(() => {
    let cancelled = false;
    rememberInvite({ code: leagueCode, ref: ref ?? "" });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      try {
        await attach({ data: { code: leagueCode, ref: ref ?? "" } });
        const membership = await check();
        if (cancelled) return;
        if (!membership.entitled) {
          setMessage(`Grab ${SZN_PASS.name} to join this league.`);
          setState("paywall");
          return;
        }
        setMessage("Adding you to the league…");
        const leagueId = await join({ data: { code: leagueCode } });
        clearInvite();
        navigate({ to: "/leagues/$leagueId", params: { leagueId }, replace: true });
      } catch (err) {
        if (cancelled) return;
        setMessage(
          err instanceof Error
            ? err.message.replace(/^.*Exception:?\s*/i, "")
            : "That invite didn't work.",
        );
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueCode, ref]);

  async function startCheckout() {
    setBusy(true);
    try {
      const { url } = await checkout({ data: { leagueCode, ref: ref ?? "" } });
      window.location.href = url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout didn't open. Try again.");
      setState("error");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <img
          src={logoAsset.url}
          alt="Gridiron Gods"
          className="mx-auto h-16 w-16 rounded-lg object-cover"
        />
        <h1 className="mt-4 text-2xl font-semibold uppercase">You're invited</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          League invite code <span className="font-medium tracking-widest">{leagueCode}</span>
        </p>

        <div className="mt-6 rounded-lg border border-border bg-card p-5">
          {state === "working" && (
            <p className="flex items-center justify-center gap-2 text-sm">
              <Loader2 size={15} className="animate-spin" /> {message}
            </p>
          )}

          {state === "paywall" && (
            <>
              <p className="flex items-center justify-center gap-2 text-sm font-medium">
                <Trophy size={15} /> {SZN_PASS.name} — {SZN_PASS.priceLabel}
              </p>
              {ref ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Your friend's invite takes $5 off today, and you both get $5 SZN Credit once
                  you're in.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  One pass unlocks every league you create or join.
                </p>
              )}
              <button
                type="button"
                onClick={startCheckout}
                disabled={busy}
                className="mt-4 min-h-12 w-full rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground disabled:opacity-40"
              >
                {busy ? "Opening checkout…" : `Get ${SZN_PASS.name} and join`}
              </button>
            </>
          )}

          {state === "error" && (
            <>
              <p role="alert" className="text-sm text-destructive">
                {message}
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/leagues" })}
                className="mt-4 min-h-12 w-full rounded-md border border-border-strong px-4 text-sm font-medium"
              >
                Go to your leagues
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
