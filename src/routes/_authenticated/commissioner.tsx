import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Landmark,
  MessageSquare,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import {
  bankSummary,
  collected,
  fetchBankDeposits,
  fetchCashTxns,
  fetchCurrentWeek,
  fetchEntryPayments,
  fetchMembers,
  fetchMyLeagues,
  fetchPayouts,
  money,
  seasonPotFor,
  weeklyPotFor,
  TOTAL_WEEKS,
} from "@/lib/pool";
import { useLiveScores } from "@/hooks/useLiveScores";
import { MembersPanel } from "@/components/pool/MembersPanel";
import { EntryPaymentsPanel } from "@/components/pool/EntryPaymentsPanel";
import { PotPanel } from "@/components/pool/PotPanel";
import { CashPanel } from "@/components/pool/CashPanel";
import { BankPanel } from "@/components/pool/BankPanel";
import { ChatPanel } from "@/components/pool/ChatPanel";
import { EmptyState, LoadingState } from "@/components/ui/feedback";

export const Route = createFileRoute("/_authenticated/commissioner")({
  head: () => ({
    meta: [
      { title: "Commissioner — Gridiron Gods" },
      {
        name: "description",
        content:
          "Run your league from one place: members, weekly entry payments, pot payouts, cash pool, bank and chat.",
      },
      { property: "og:title", content: "Commissioner — Gridiron Gods" },
      {
        property: "og:description",
        content:
          "Run your league from one place: members, weekly entry payments, pot payouts, cash pool, bank and chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommissionerPage,
});

type Section = "members" | "payments" | "pot" | "cash" | "bank" | "chat";

const SECTIONS: { id: Section; label: string; icon: typeof Users }[] = [
  { id: "members", label: "Members", icon: Users },
  { id: "payments", label: "Entry payments", icon: CheckCircle2 },
  { id: "pot", label: "Pot & payouts", icon: Banknote },
  { id: "cash", label: "Cash pool", icon: Wallet },
  { id: "bank", label: "League bank", icon: Landmark },
  { id: "chat", label: "Chat", icon: MessageSquare },
];

function CommissionerPage() {
  useLiveScores();
  const { user } = Route.useRouteContext();

  const leagues = useQuery({ queryKey: ["leagues"], queryFn: fetchMyLeagues });
  const currentWeek = useQuery({ queryKey: ["current-week"], queryFn: fetchCurrentWeek });

  const owned = (leagues.data ?? []).filter((l) => l.owner_id === user.id);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [section, setSection] = useState<Section>("members");

  useEffect(() => {
    if (!leagueId && owned[0]) setLeagueId(owned[0].id);
  }, [owned, leagueId]);

  useEffect(() => {
    if (week == null && currentWeek.data) setWeek(currentWeek.data);
  }, [currentWeek.data, week]);

  const league = owned.find((l) => l.id === leagueId) ?? null;
  const activeWeek = week ?? currentWeek.data ?? 1;

  const members = useQuery({
    queryKey: ["members", league?.id],
    queryFn: () => fetchMembers(league!.id),
    enabled: !!league,
  });
  const payments = useQuery({
    queryKey: ["entry-payments", league?.id],
    queryFn: () => fetchEntryPayments(league!.id),
    enabled: !!league,
  });
  const deposits = useQuery({
    queryKey: ["bank", league?.id],
    queryFn: () => fetchBankDeposits(league!.id),
    enabled: !!league,
  });
  const cash = useQuery({
    queryKey: ["cash", league?.id],
    queryFn: () => fetchCashTxns(league!.id),
    enabled: !!league,
  });
  const payouts = useQuery({
    queryKey: ["payouts", league?.id],
    queryFn: () => fetchPayouts(league!.id),
    enabled: !!league,
  });

  if (leagues.isLoading) return <LoadingState label="Loading commissioner dashboard" />;

  if (!owned.length)
    return (
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Commissioner</h1>
        <div className="mt-5"><EmptyState icon={ShieldCheck} title="No leagues to manage" description="Start a league and this page becomes your control room." action={<Link
            to="/leagues"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            Start a league
          </Link>} /></div>
      </div>
    );

  if (!league) return <LoadingState label="Loading league controls" />;

  const memberList = members.data ?? [];
  const paidRows = (payments.data ?? []).filter((p) => p.weekNum === activeWeek);
  const paidMembers = new Set(paidRows.map((p) => p.userId)).size;
  const takeIn = collected(payments.data ?? [], activeWeek, Number(league.entry_fee) || 0).week;
  const bank = bankSummary(deposits.data ?? [], cash.data ?? [], payouts.data ?? []);

  const stats = [
    { label: "Members", value: String(memberList.length) },
    {
      label: `Week ${activeWeek} paid`,
      value: `${Math.min(paidMembers, memberList.length)} of ${memberList.length}`,
      hint: `${money(takeIn)} collected`,
    },
    {
      label: `Week ${activeWeek} pot`,
      value: money(weeklyPotFor(league, payments.data ?? [], activeWeek)),
    },
    { label: "Season pot", value: money(seasonPotFor(league, payments.data ?? [])) },
    { label: "Bank balance", value: money(bank.balance) },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
            <ShieldCheck size={20} className="shrink-0 text-accent" /> Commissioner
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you need to run {league.name} in one place.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label className="mb-1 block text-xs text-faint" htmlFor="league">
              League
            </label>
            <select
              id="league"
              value={league.id}
              onChange={(e) => setLeagueId(e.target.value)}
              className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            >
              {owned.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1 block text-xs text-faint" htmlFor="cweek">
              Week
            </label>
            <select
              id="cweek"
              value={activeWeek}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm sm:w-28"
            >
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3 sm:p-3.5">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-base font-semibold sm:text-lg">{s.value}</p>
            {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
          </div>
        ))}
      </div>

      <div className="sticky top-[3.4rem] z-20 -mx-4 mb-5 border-b border-border bg-background/95 px-4 backdrop-blur sm:static sm:mx-0 sm:mb-6 sm:px-0 sm:backdrop-blur-none">
        <div className="no-scrollbar flex snap-x gap-1 overflow-x-auto" role="tablist" aria-label="Commissioner sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={`-mb-px flex min-h-12 shrink-0 snap-start items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium sm:px-3.5 ${
                section === s.id ? "border-accent text-foreground" : "border-transparent text-faint"
              }`}
            >
              <s.icon size={15} /> {s.label}
            </button>
          ))}
        </div>
      </div>

      {section === "members" && (
        <MembersPanel
          league={league}
          members={memberList}
          isOwner
          currentUserId={user.id}
        />
      )}
      {section === "payments" && (
        <EntryPaymentsPanel
          league={league}
          members={memberList}
          isOwner
          currentUserId={user.id}
          week={activeWeek}
        />
      )}
      {section === "pot" && (
        <PotPanel
          league={league}
          members={memberList}
          isOwner
          currentUserId={user.id}
          week={activeWeek}
        />
      )}
      {section === "cash" && (
        <CashPanel league={league} members={memberList} currentUserId={user.id} />
      )}
      {section === "bank" && <BankPanel league={league} isOwner currentUserId={user.id} />}
      {section === "chat" && <ChatPanel league={league} isOwner currentUserId={user.id} />}

      <div className="mt-6">
        <Link
          to="/leagues/$leagueId"
          params={{ leagueId: league.id }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Open the full league page
        </Link>
      </div>
    </div>
  );
}
