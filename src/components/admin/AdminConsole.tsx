"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Flag,
  LogOut,
  RotateCcw,
  Search,
  ShieldCheck,
  Users2,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Badge } from "@/components/ui/Primitives";
import { Input } from "@/components/ui/Field";
import { STATUS_META, kycCounts, type AdminUser, type KycStatus } from "@/lib/kyc";
import { STATUS_FILTERS, useAdminStore } from "@/lib/adminStore";
import { useStore } from "@/lib/store";
import { money, relativeTime } from "@/lib/format";
import { cn, initialsOf } from "@/lib/utils";
import { AdminUserDetail } from "./AdminUserDetail";

/** Builds an AdminUser row that mirrors the live signed-in session. */
function useCurrentSessionRow(): AdminUser | null {
  const user = useStore((s) => s.user);
  const kyc = useStore((s) => s.kyc);
  const balance = useStore((s) => s.balance);
  const txns = useStore((s) => s.txns);
  const positions = useStore((s) => s.positions);
  const copies = useStore((s) => s.copies);

  if (!user) return null;

  const deposits = txns.filter((t) => t.kind === "deposit").reduce((s, t) => s + t.amount, 0);
  const withdrawals = txns.filter((t) => t.kind === "withdrawal").reduce((s, t) => s + t.amount, 0);

  return {
    id: "session",
    firstName: user.firstName,
    lastName: user.lastName || "—",
    email: user.email,
    phone: user.phone || "—",
    country: user.country,
    flag: "🧑‍💻",
    accountType: "Standard",
    balance,
    equity: balance,
    deposits,
    withdrawals,
    openTrades: positions.length,
    copying: copies.filter((c) => c.status === "active").length,
    joinedAt: user.createdAt,
    lastActiveAt: Date.now(),
    flagged: false,
    isCurrentSession: true,
    kyc: {
      status: kyc.status,
      idType: kyc.idType,
      idNumberMasked: kyc.idNumberMasked || "—",
      dateOfBirth: kyc.dateOfBirth || "—",
      residentialAddress: kyc.residentialAddress || "—",
      documents: kyc.documents,
      submittedAt: kyc.submittedAt,
      reviewedAt: kyc.reviewedAt,
      reviewedBy: kyc.reviewedAt ? "compliance@primestone.com" : null,
      rejectionReason: kyc.rejectionReason,
    },
  };
}

export function AdminConsole() {
  const users = useAdminStore((s) => s.users);
  const signOut = useAdminStore((s) => s.signOut);
  const reseed = useAdminStore((s) => s.reseed);
  const sessionRow = useCurrentSessionRow();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<KycStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The live session sits at the top of the directory when signed in.
  const allUsers = useMemo(
    () => (sessionRow ? [sessionRow, ...users] : users),
    [sessionRow, users],
  );

  const counts = useMemo(() => kycCounts(allUsers), [allUsers]);

  const results = useMemo(() => {
    let list = allUsers;
    if (filter !== "all") list = list.filter((u) => u.kyc.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allUsers, filter, query]);

  const selected = allUsers.find((u) => u.id === selectedId) ?? null;

  const STATS = [
    { label: "Total users", value: allUsers.length, icon: Users2, tone: "text-white" },
    { label: "Pending review", value: counts.pending, icon: Clock, tone: "text-amber-450" },
    { label: "Verified", value: counts.verified, icon: ShieldCheck, tone: "text-mint-400" },
    { label: "Rejected", value: counts.rejected, icon: XCircle, tone: "text-rose-400" },
  ];

  return (
    <div className="min-h-dvh bg-ink-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <Badge tone="iris" className="hidden sm:inline-flex">
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reseed}
              className="focus-ring hidden h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12.5px] text-slate-300 hover:bg-white/[0.08] sm:inline-flex"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reseed demo
            </button>
            <button
              onClick={signOut}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[12.5px] text-slate-300 hover:bg-white/[0.08]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="mb-1 flex items-end justify-between">
          <div>
            <h1 className="font-display text-[24px] font-bold text-white">User management</h1>
            <p className="mt-1 text-[14px] text-slate-400">
              Review identity submissions and manage every account on the platform.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="card-sheen rounded-2xl border border-white/[0.07] bg-ink-880/70 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">{s.label}</span>
                <s.icon className={cn("h-4 w-4", s.tone)} />
              </div>
              <p className={cn("tnum mt-2 font-display text-[26px] font-bold", s.tone)}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, country…"
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "focus-ring rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                  filter === f.id
                    ? "bg-white/[0.10] text-white"
                    : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200",
                )}
              >
                {f.label}
                {f.id !== "all" && (
                  <span className="tnum ml-1.5 text-slate-500">{counts[f.id]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-880/50">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Country</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                  <th className="px-4 py-3 font-medium">KYC status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((u) => (
                  <AdminRow key={u.id} user={u} onOpen={() => setSelectedId(u.id)} />
                ))}
              </tbody>
            </table>
          </div>
          {results.length === 0 && (
            <div className="px-4 py-14 text-center text-[14px] text-slate-500">
              No users match those filters.
            </div>
          )}
        </div>

        <p className="mt-3 text-[12px] text-slate-600">
          Showing {results.length} of {allUsers.length} accounts. ID numbers are masked; full
          documents open in the review panel.
        </p>
      </main>

      <AnimatePresence>
        {selected && (
          <AdminUserDetail user={selected} onClose={() => setSelectedId(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Row                                                                        */
/* -------------------------------------------------------------------------- */

function AdminRow({ user, onOpen }: { user: AdminUser; onOpen: () => void }) {
  const meta = STATUS_META[user.kyc.status];
  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.03]"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
            style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
          >
            {initialsOf(`${user.firstName} ${user.lastName}`)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13.5px] font-medium text-white">
                {user.firstName} {user.lastName}
              </p>
              {user.isCurrentSession && <Badge tone="mint">You</Badge>}
              {user.flagged && <Flag className="h-3 w-3 text-rose-400" />}
            </div>
            <p className="truncate text-[12px] text-slate-500">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-300">
        {user.flag} {user.country}
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-400">{user.accountType}</td>
      <td className="tnum px-4 py-3 text-right text-[13px] font-medium text-white">
        {money(user.balance)}
      </td>
      <td className="px-4 py-3">
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </td>
      <td className="px-4 py-3 text-[12.5px] text-slate-400">
        {user.kyc.submittedAt ? relativeTime(user.kyc.submittedAt, Date.now()) : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-[12.5px] font-medium text-mint-400">Review →</span>
      </td>
    </tr>
  );
}
