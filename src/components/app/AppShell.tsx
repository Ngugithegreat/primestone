"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CandlestickChart,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { Badge, LiveDot, SpringNumber } from "@/components/ui/Primitives";
import { useMarket } from "@/components/providers/MarketProvider";
import { getAccountType } from "@/lib/accounts";
import { openPnl, usedMargin, useHydrated, useStore } from "@/lib/store";
import { cn, initialsOf } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/traders", label: "Copy traders", icon: Users },
  { href: "/trade", label: "Trading desk", icon: CandlestickChart },
  { href: "/portfolio", label: "Portfolio", icon: BarChart3 },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

/* -------------------------------------------------------------------------- */
/*  Shell                                                                      */
/* -------------------------------------------------------------------------- */

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const user = useStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!hydrated) return <ShellSkeleton />;
  if (!user) return <ShellSkeleton />;

  return (
    <div className="min-h-dvh bg-ink-950">
      {/* Ambient */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 20% -5%, rgba(0,223,164,0.09), transparent 60%), radial-gradient(ellipse 60% 45% at 90% 0%, rgba(99,102,241,0.08), transparent 60%)",
        }}
        aria-hidden="true"
      />

      <Sidebar className="fixed inset-y-0 left-0 z-40 hidden w-[248px] lg:flex" />

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 flex w-[268px] lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Sidebar className="w-full" onClose={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="lg:pl-[248px]">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink-950">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="h-11 w-11 animate-pulse" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-transparent via-mint-500 to-transparent bg-[length:200%_100%]" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const user = useStore((s) => s.user);
  const copies = useStore((s) => s.copies);
  const positions = useStore((s) => s.positions);
  const acct = getAccountType(user?.accountType);

  const counts: Record<string, number> = {
    "/traders": copies.filter((c) => c.status === "active").length,
    "/trade": positions.length,
  };

  return (
    <aside
      className={cn(
        "flex-col border-r border-white/[0.07] bg-ink-900/70 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
        <Logo href="/dashboard" />
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const count = counts[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-medium transition-all duration-200",
                active
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-mint-500"
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  active ? "text-mint-400" : "text-slate-500 group-hover:text-slate-300",
                )}
              />
              <span className="flex-1">{item.label}</span>
              {count ? (
                <span className="tnum rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[11px] text-slate-300">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-white/[0.06] p-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Account
            </span>
            <Badge tone="mint">Demo</Badge>
          </div>
          <p className="mt-2 text-[14px] font-semibold text-white">{acct.name}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            1:{user?.leverage} · {acct.spreadLabel}
          </p>
        </div>

        <Link
          href="/wallet"
          className="focus-ring flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-mint-500 text-[13.5px] font-semibold text-ink-950 transition-colors hover:bg-mint-400"
        >
          <Wallet className="h-4 w-4" />
          Deposit funds
        </Link>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/*  Top bar                                                                    */
/* -------------------------------------------------------------------------- */

function TopBar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const { prices } = useMarket();
  const user = useStore((s) => s.user);
  const balance = useStore((s) => s.balance);
  const positions = useStore((s) => s.positions);
  const signOut = useStore((s) => s.signOut);
  const [menuOpen, setMenuOpen] = useState(false);

  const floating = useMemo(() => openPnl(positions, prices), [positions, prices]);
  const margin = useMemo(
    () => usedMargin(positions, prices, user?.leverage ?? 500),
    [positions, prices, user?.leverage],
  );
  const equity = balance + floating;
  const free = equity - margin;
  const marginLevel = margin > 0 ? (equity / margin) * 100 : 0;

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          onClick={onMenu}
          aria-label="Open menu"
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        {/* Account metrics */}
        <div className="flex flex-1 items-center gap-1 overflow-x-auto">
          <Metric label="Equity" value={equity} tone="text-white" />
          <Divider />
          <Metric label="Balance" value={balance} tone="text-slate-200" />
          <Divider className="hidden sm:block" />
          <Metric
            label="Open P&L"
            value={floating}
            tone={floating >= 0 ? "text-mint-400" : "text-rose-400"}
            signed
            className="hidden sm:flex"
          />
          <Divider className="hidden xl:block" />
          <Metric label="Free margin" value={free} tone="text-slate-200" className="hidden xl:flex" />
          <Divider className="hidden xl:block" />
          <div className="hidden flex-col px-3 xl:flex">
            <span className="text-[10.5px] uppercase tracking-[0.1em] text-slate-500">
              Margin level
            </span>
            <span
              className={cn(
                "tnum text-[14px] font-semibold",
                marginLevel === 0 || marginLevel > 300
                  ? "text-slate-200"
                  : marginLevel > 150
                    ? "text-amber-450"
                    : "text-rose-400",
              )}
            >
              {marginLevel > 0 ? `${marginLevel.toFixed(0)}%` : "—"}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <LiveDot label="MARKET OPEN" />
        </div>

        {/* Account menu */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="focus-ring flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-white/[0.07]"
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-[12px] font-semibold text-ink-950"
              style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
            >
              {initialsOf(`${user?.firstName ?? "A"} ${user?.lastName ?? "S"}`)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-[13px] font-medium leading-tight text-white">
                {user?.firstName}
              </span>
              <span className="block text-[11px] leading-tight text-slate-500">
                {getAccountType(user?.accountType).name}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                onClick={(e) => e.stopPropagation()}
                className="card-sheen absolute right-0 top-[calc(100%+10px)] w-64 overflow-hidden rounded-xl border border-white/[0.09] bg-ink-850/97 shadow-[0_30px_70px_-25px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
              >
                <div className="border-b border-white/[0.06] p-4">
                  <p className="text-[14px] font-semibold text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="truncate text-[12px] text-slate-500">{user?.email}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                    Account settings
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      router.push("/");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] text-rose-400 transition-colors hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  tone,
  signed = false,
  className,
}: {
  label: string;
  value: number;
  tone: string;
  signed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 flex-col px-3", className)}>
      <span className="text-[10.5px] uppercase tracking-[0.1em] text-slate-500">{label}</span>
      <span className={cn("tnum text-[14px] font-semibold", tone)}>
        {signed && value >= 0 ? "+" : signed ? "-" : ""}$
        <SpringNumber value={Math.abs(value)} />
      </span>
    </div>
  );
}

function Divider({ className }: { className?: string }) {
  return <span className={cn("h-8 w-px shrink-0 bg-white/[0.07]", className)} />;
}
