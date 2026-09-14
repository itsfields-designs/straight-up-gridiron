import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CreditCard, Loader2, RefreshCw } from "lucide-react";

import {
  checkMembership,
  createSznCheckout,
  openCustomerPortal,
  SZN_PASS,
} from "@/lib/membership.functions";

export function MembershipCard() {
  const check = useServerFn(checkMembership);
  const checkout = useServerFn(createSznCheckout);
  const portal = useServerFn(openCustomerPortal);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);

  const status = useQuery({
    queryKey: ["membership"],
    queryFn: () => check(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("membership");
    if (flag) status.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(kind: "checkout" | "portal") {
    setError("");
    setBusy(kind);
    try {
      const { url } = kind === "checkout" ? await checkout() : await portal();
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const subscribed = status.data?.subscribed;

  return (
    <div
      className={`rounded-lg border p-4 ${
        subscribed ? "border-accent bg-accent-soft" : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="field-label">Membership</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{SZN_PASS.name}</span>
            {subscribed && (
              <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                <BadgeCheck size={11} /> Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {subscribed
              ? `Renews by ${new Date(status.data!.subscriptionEnd!).toLocaleDateString()}`
              : `${SZN_PASS.priceLabel} · billed once a year`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => status.refetch()}
            className="rounded-md border border-border-strong px-2 py-1.5 text-xs transition-colors hover:bg-secondary"
            aria-label="Refresh membership status"
          >
            <RefreshCw size={13} className={status.isFetching ? "animate-spin" : ""} />
          </button>
          {subscribed ? (
            <button
              type="button"
              onClick={() => run("portal")}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-40"
            >
              {busy === "portal" ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
              Manage subscription
            </button>
          ) : (
            <button
              type="button"
              onClick={() => run("checkout")}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40"
            >
              {busy === "checkout" ? <Loader2 size={13} className="animate-spin" /> : null}
              Get {SZN_PASS.name}
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
