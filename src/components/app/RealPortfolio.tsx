"use client";

import Link from "next/link";
import { PiggyBank, TrendingUp, Users, Wallet as WalletIcon } from "lucide-react";
import { StatTile } from "./StatTile";
import { LiveCopiedTrades } from "./LiveCopiedTrades";
import { Badge, Card } from "@/components/ui/Primitives";
import { usd } from "@/lib/accountClient";
import { useRealAccount } from "@/lib/useRealAccount";
import { cn, initialsOf } from "@/lib/utils";

/** Portfolio for a real, ledger-backed account — real USD money only, no demo. */
export function RealPortfolio() {
  const real = useRealAccount();
  const subs = (real.account?.allocations ?? []).filter((a) => a.status !== "closed");
  const payments = real.account?.payments ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-[26px] font-bold text-white">Portfolio</h1>
            <Badge tone="mint" dot>
              Real account
            </Badge>
          </div>
          <p className="mt-1 text-[14px] text-slate-400">
            Your real money — balances, copied positions and settled performance.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile index={0} label="Account value" value={usd(real.totalMinor)} icon={WalletIcon} accent="#00dfa4" />
        <StatTile index={1} label="Available" value={usd(real.balanceMinor)} icon={PiggyBank} accent="#2ff0bd" footer="Not yet allocated" />
        <StatTile index={2} label="Copying" value={usd(real.allocatedMinor)} icon={Users} accent="#818cf8" footer={`${subs.length} provider${subs.length === 1 ? "" : "s"}`} />
        <StatTile
          index={3}
          label="Realized P&L"
          value={`${real.realizedPnlMinor >= 0 ? "+" : "-"}${usd(Math.abs(real.realizedPnlMinor))}`}
          icon={TrendingUp}
          accent={real.realizedPnlMinor >= 0 ? "#00dfa4" : "#f43f5e"}
          footer="All-time, from closed trades"
        />
      </div>

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
          <p className="mt-4 text-[13px] text-slate-500">
            You aren&rsquo;t copying anyone yet. Browse{" "}
            <Link href="/traders" className="text-mint-400 hover:text-mint-300">
              strategy providers
            </Link>{" "}
            to start.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {subs.map((a) => {
              const pnl = a.valueMinor - a.amountMinor;
              return (
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
                      <p className="truncate text-[13.5px] font-medium text-white">{a.provider.name}</p>
                      <p className="truncate text-[11.5px] text-slate-500">{a.provider.strategy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[13.5px] font-semibold text-white">{usd(a.valueMinor)}</p>
                    <p className={cn("tnum text-[11.5px]", pnl >= 0 ? "text-mint-400" : "text-rose-400")}>
                      {pnl >= 0 ? "+" : "-"}
                      {usd(Math.abs(pnl))} P&L
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Transactions */}
      {payments.length > 0 && (
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-white">Transactions</h2>
          <div className="mt-4 space-y-1.5">
            {payments.slice(0, 15).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-lg",
                      p.kind === "deposit" ? "bg-mint-500/12 text-mint-400" : "bg-rose-500/12 text-rose-400",
                    )}
                  >
                    <WalletIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium capitalize text-white">
                      {p.kind} · {p.provider}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(p.createdAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("tnum text-[13px] font-semibold", p.kind === "deposit" ? "text-mint-400" : "text-white")}>
                    {p.kind === "deposit" ? "+" : "-"}
                    {usd(p.amountMinor)}
                  </p>
                  <Badge tone={p.status === "completed" ? "mint" : p.status === "failed" ? "rose" : "amber"}>
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
