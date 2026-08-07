"use client";

import Link from "next/link";
import { ArrowRight, PiggyBank, ShieldCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { StatTile } from "./StatTile";
import { LiveCopiedTrades } from "./LiveCopiedTrades";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card } from "@/components/ui/Primitives";
import { usd } from "@/lib/accountClient";
import { useRealAccount } from "@/lib/useRealAccount";
import { useStore } from "@/lib/store";
import { initialsOf } from "@/lib/utils";

/** The dashboard for a real, funded (live) account — real KES money only. */
export function LiveOverview() {
  const user = useStore((s) => s.user);
  const real = useRealAccount();
  const kyc = useStore((s) => s.kyc.status);

  const subs = (real.account?.allocations ?? []).filter((a) => a.status !== "closed");
  const g = greeting();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[26px] font-bold leading-tight text-white">
              {g}, {user?.firstName}
            </h1>
            <Badge tone="mint" dot>
              Live account
            </Badge>
          </div>
          <p className="mt-1 text-[14px] text-slate-400">
            {subs.length > 0
              ? `You are copying ${subs.length} strategy ${subs.length === 1 ? "provider" : "providers"}.`
              : "Your funds are ready — assign them to a strategy provider to start copying."}
          </p>
        </div>
        <div className="flex gap-2.5">
          <ButtonLink href="/wallet" variant="secondary" size="sm">
            <Wallet className="h-4 w-4" />
            Deposit
          </ButtonLink>
          <ButtonLink href="/wallet" size="sm">
            <Users className="h-4 w-4" />
            Copy a provider
          </ButtonLink>
        </div>
      </div>

      {/* Real money tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          label="Account value"
          value={usd(real.totalMinor)}
          icon={Wallet}
          accent="#00dfa4"
          delta={{ value: "Real funds", positive: true }}
        />
        <StatTile
          index={1}
          label="Available to allocate"
          value={usd(real.balanceMinor)}
          icon={PiggyBank}
          accent="#2ff0bd"
          footer="Not yet assigned"
        />
        <StatTile
          index={2}
          label="Copying"
          value={usd(real.allocatedMinor)}
          icon={TrendingUp}
          accent="#818cf8"
          delta={
            real.realizedPnlMinor !== 0
              ? {
                  value: `${real.realizedPnlMinor > 0 ? "+" : "-"}${usd(Math.abs(real.realizedPnlMinor))} realized`,
                  positive: real.realizedPnlMinor >= 0,
                }
              : undefined
          }
          footer={`${subs.length} active subscription${subs.length === 1 ? "" : "s"}`}
        />
        <StatTile
          index={3}
          label="Identity"
          value={
            kyc === "verified" ? "Verified" : kyc === "pending" ? "Under review" : "Not verified"
          }
          icon={ShieldCheck}
          accent={kyc === "verified" ? "#00dfa4" : kyc === "pending" ? "#fbbf24" : "#64748b"}
          footer={kyc === "verified" ? "Withdrawals enabled" : "Required to withdraw"}
        />
      </div>

      {/* Live copied trades (marks against real prices) */}
      <LiveCopiedTrades positions={real.openPositions} />

      {/* Subscriptions */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">Your subscriptions</h2>
          <Link href="/wallet" className="text-[13px] font-medium text-mint-400 hover:text-mint-300">
            Manage →
          </Link>
        </div>

        {subs.length === 0 ? (
          <div className="mt-4 grid place-items-center rounded-xl border border-white/[0.07] bg-white/[0.02] px-6 py-12 text-center">
            <Users className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-[14px] font-medium text-white">No subscriptions yet</p>
            <p className="mt-1 max-w-sm text-[13px] text-slate-400">
              Assign your {usd(real.balanceMinor)} to a provider and their trades mirror into
              your account.
            </p>
            <ButtonLink href="/wallet" size="sm" className="mt-4">
              Browse providers
              <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {subs.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
                    style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
                  >
                    {initialsOf(a.provider.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-white">
                      {a.provider.name}
                    </p>
                    <p className="truncate text-[11.5px] text-slate-500">{a.provider.strategy}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="tnum text-[13.5px] font-semibold text-white">{usd(a.valueMinor)}</p>
                  {a.valueMinor !== a.amountMinor ? (
                    <p
                      className={`tnum text-[11.5px] ${a.valueMinor >= a.amountMinor ? "text-mint-400" : "text-rose-400"}`}
                    >
                      {a.valueMinor >= a.amountMinor ? "+" : "-"}
                      {usd(Math.abs(a.valueMinor - a.amountMinor))} P&L
                    </p>
                  ) : (
                    <p className="tnum text-[11.5px] text-slate-500">{usd(a.amountMinor)} in</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="text-center text-[12px] text-slate-600">
        Want to practise with virtual funds first? The{" "}
        <Link href="/trade" className="text-slate-400 underline-offset-2 hover:underline">
          Trading desk
        </Link>{" "}
        is a separate demo account on live charts.
      </p>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
