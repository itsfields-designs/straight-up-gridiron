import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Gift, Share2 } from "lucide-react";

import { getReferralInfo } from "@/lib/referrals.functions";
import { inviteLink, shareInvite } from "@/lib/invite";

/**
 * The one invitation members ever see: a single link that carries the league
 * and the inviter, worth $5 SZN Credit to both of them.
 */
export function InviteFriends({
  leagueCode,
  leagueName,
  compact = false,
}: {
  leagueCode: string;
  leagueName: string;
  compact?: boolean;
}) {
  const info = useQuery({ queryKey: ["referral-info"], queryFn: () => getReferralInfo() });
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState("");
  const [showCode, setShowCode] = useState(false);

  const link = info.data ? inviteLink(leagueCode, info.data.refId) : "";

  async function copy() {
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    if (!link) return;
    const result = await shareInvite(link, leagueName);
    if (result !== "cancelled") setShared(result === "copied" ? "Link copied" : "Shared");
    setTimeout(() => setShared(""), 1800);
  }

  return (
    <section className="rounded-xl border border-accent bg-accent-soft p-4">
      <div className="flex items-center gap-2">
        <Gift size={16} />
        <h2 className="font-display text-2xl font-semibold">Invite friends</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Bring your friends into this league. You both get $5 SZN Credit when they join.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          aria-live="polite"
           className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg bg-card px-4 text-sm font-semibold text-foreground disabled:opacity-40"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Link copied" : "Copy Invite Link"}
        </button>
        <button
          type="button"
          onClick={share}
          disabled={!link}
           className="flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-card px-4 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-40"
        >
          <Share2 size={15} /> {shared || "Share"}
        </button>
      </div>

      {!compact && info.data && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Friends invited", value: String(info.data.invited) },
            { label: "Joined", value: String(info.data.successful) },
            {
              label: "SZN Credit",
              value: `$${info.data.creditEarned.toFixed(2)}`,
            },
          ].map((s) => (
            <div key={s.label} className="rounded-md bg-card px-3 py-2 text-center">
              <div className="font-display text-base font-medium">{s.value}</div>
              <div className="text-[11px] text-faint">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCode((v) => !v)}
        className="mt-3 min-h-11 text-xs text-muted-foreground underline underline-offset-2"
      >
        {showCode ? "Hide manual invite code" : "Or enter invite code manually"}
      </button>
      {showCode && (
        <p className="text-xs text-muted-foreground">
          Or enter invite code manually:{" "}
          <span className="font-display tracking-widest">{leagueCode}</span>
        </p>
      )}
    </section>
  );
}
