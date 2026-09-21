import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, RefreshCw } from "lucide-react";

import { checkMembership, createSznCheckout, SZN_PASS } from "@/lib/membership.functions";
import { readInvite } from "@/lib/invite";

/** True when the signed-in account may make picks or start duels. */
export function useEntitled() {
  const check = useServerFn(checkMembership);
  const query = useQuery({
    queryKey: ["membership"],
    queryFn: () => check(),
    refetchInterval: 60_000,
  });
  return {
    entitled: query.data?.entitled ?? false,
    loading: query.isLoading,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

/** Paywall card shown in place of a locked feature. */
export function SznPassGate({ what }: { what: string }) {
  const checkout = useServerFn(createSznCheckout);
  const { refetch, isFetching } = useEntitled();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setError("");
    setBusy(true);
    try {
      const invite = readInvite();
      const { url } = await checkout({
        data: invite ? { leagueCode: invite.code, ref: invite.ref } : {},
      });
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
        <Lock size={18} />
      </span>
      <h2 className="mt-3 font-display text-lg font-semibold">{SZN_PASS.name} required</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {what} is for pass holders. Get {SZN_PASS.name} — {SZN_PASS.priceLabel} — and you're in for
        the whole season.
      </p>
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-foreground disabled:opacity-60"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          Get {SZN_PASS.name}
        </button>
        <button
          type="button"
          onClick={() => refetch()}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong text-sm font-medium"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          I've paid — refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
