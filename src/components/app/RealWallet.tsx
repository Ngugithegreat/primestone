"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Smartphone,
  TrendingUp,
  Wallet as WalletIcon,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Badge, Card } from "@/components/ui/Primitives";
import {
  closeAllocation,
  getAccount,
  getRealProviders,
  ksh,
  mpesaDeposit,
  mpesaStatus,
  subscribeToProvider,
  type AccountSnapshot,
  type RealProvider,
} from "@/lib/accountClient";
import { useStore } from "@/lib/store";
import { cn, initialsOf } from "@/lib/utils";

/**
 * The real, ledger-backed money experience for authenticated users: live
 * balance, M-Pesa deposits, and subscribing real funds to signal providers.
 */
export function RealWallet() {
  const user = useStore((s) => s.user);
  const pushToast = useStore((s) => s.pushToast);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [providers, setProviders] = useState<RealProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [acc, provs] = await Promise.all([getAccount(), getRealProviders()]);
    setAccount(acc);
    setProviders(provs);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-mint-400" />
      </div>
    );
  }

  const balanceMinor = account?.balanceMinor ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[26px] font-bold text-white">Wallet</h1>
        <p className="mt-1 text-[14px] text-slate-400">
          Deposit with M-Pesa and assign your funds to a strategy provider.
        </p>
      </div>

      {/* Balance */}
      <Card className="card-sheen overflow-hidden p-0">
        <div className="relative p-6">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-[70px]"
            style={{ background: "radial-gradient(closest-side, rgba(0,223,164,0.22), transparent 70%)" }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] uppercase tracking-[0.14em] text-slate-500">
                Available balance
              </p>
              <p className="mt-1.5 font-display text-[34px] font-bold leading-none text-white">
                {ksh(balanceMinor)}
              </p>
              <p className="mt-2 text-[12.5px] text-slate-500">
                {user?.firstName ? `${user.firstName}'s account` : "Your account"} · real funds
              </p>
            </div>
            <Badge tone="mint" dot>
              Live balance
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <MpesaDeposit defaultPhone={user?.phone ?? ""} onCredited={refresh} />
        <Providers
          providers={providers}
          balanceMinor={balanceMinor}
          onSubscribed={refresh}
          pushToast={pushToast}
        />
      </div>

      <Allocations account={account} onChanged={refresh} pushToast={pushToast} />
      <History account={account} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  M-Pesa deposit                                                             */
/* -------------------------------------------------------------------------- */

function MpesaDeposit({
  defaultPhone,
  onCredited,
}: {
  defaultPhone: string;
  onCredited: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(500);
  const [phone, setPhone] = useState(defaultPhone);
  const [state, setState] = useState<"idle" | "prompting" | "waiting" | "done" | "failed">("idle");
  const [message, setMessage] = useState<string>();
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const start = async () => {
    setMessage(undefined);
    setState("prompting");
    const res = await mpesaDeposit({ amount, phone });
    if (!res.ok) {
      setState("failed");
      setMessage(res.error);
      return;
    }
    setState("waiting");
    setMessage(res.message ?? "Check your phone and enter your M-Pesa PIN.");

    // Reconcile against Safaricom until the deposit resolves. This doesn't
    // depend on the async callback arriving — the server actively queries the
    // transaction status and credits on success.
    const paymentId = res.paymentId;
    let ticks = 0;
    pollRef.current = window.setInterval(async () => {
      ticks++;
      const status = await mpesaStatus(paymentId);
      if (status === "completed") {
        window.clearInterval(pollRef.current!);
        setState("done");
        setMessage("Payment received — your balance has been updated.");
        await onCredited();
      } else if (status === "failed" || ticks > 40) {
        window.clearInterval(pollRef.current!);
        setState("failed");
        setMessage(
          status === "failed"
            ? "The payment was cancelled or failed."
            : "Still confirming — if money left your phone, it will reflect shortly. Refresh in a moment.",
        );
      }
    }, 4000);
  };

  const busy = state === "prompting" || state === "waiting";

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-mint-500/25 bg-mint-500/10">
          <Smartphone className="h-4.5 w-4.5 text-mint-400" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Deposit with M-Pesa</h2>
          <p className="text-[12px] text-slate-500">An STK prompt is sent to your phone.</p>
        </div>
      </div>

      {state === "done" ? (
        <div className="mt-5 grid place-items-center rounded-xl border border-mint-500/25 bg-mint-500/[0.07] px-4 py-8 text-center">
          <CheckCircle2 className="h-9 w-9 text-mint-400" />
          <p className="mt-3 text-[14px] font-semibold text-white">Deposit successful</p>
          <p className="mt-1 text-[12.5px] text-slate-400">{message}</p>
          <button
            onClick={() => setState("idle")}
            className="mt-4 text-[13px] font-medium text-mint-400 hover:text-mint-300"
          >
            Make another deposit
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <Field label="Amount (KES)" htmlFor="dep-amount">
            <Input
              id="dep-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.round(Number(e.target.value))))}
              disabled={busy}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[100, 500, 1000, 2500, 5000].map((v) => (
              <button
                key={v}
                type="button"
                disabled={busy}
                onClick={() => setAmount(v)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors",
                  amount === v
                    ? "border-mint-500/50 bg-mint-500/10 text-mint-300"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]",
                )}
              >
                {v.toLocaleString()}
              </button>
            ))}
          </div>
          <Field label="M-Pesa phone" htmlFor="dep-phone" hint="Safaricom number">
            <Input
              id="dep-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XX XXX XXX"
              disabled={busy}
            />
          </Field>

          {message && (
            <div
              className={cn(
                "flex items-start gap-2 rounded-lg border p-3 text-[12.5px]",
                state === "failed"
                  ? "border-rose-500/25 bg-rose-500/[0.06] text-rose-300"
                  : "border-amber-450/25 bg-amber-450/[0.06] text-amber-300",
              )}
            >
              {state === "waiting" ? (
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              {message}
            </div>
          )}

          <Button onClick={start} disabled={busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {state === "waiting"
              ? "Waiting for your PIN…"
              : state === "prompting"
                ? "Sending prompt…"
                : `Deposit KES ${amount.toLocaleString()}`}
          </Button>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Providers (subscribe)                                                      */
/* -------------------------------------------------------------------------- */

function Providers({
  providers,
  balanceMinor,
  onSubscribed,
  pushToast,
}: {
  providers: RealProvider[];
  balanceMinor: number;
  onSubscribed: () => Promise<void>;
  pushToast: (t: { tone: "success" | "error" | "info"; title: string; body?: string }) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  const subscribe = async (p: RealProvider) => {
    setBusy(true);
    const res = await subscribeToProvider({ providerId: p.id, amount });
    setBusy(false);
    if (!res.ok) {
      pushToast({ tone: "error", title: "Could not subscribe", body: res.error });
      return;
    }
    pushToast({ tone: "success", title: `Subscribed to ${p.name}`, body: `${ksh(amount * 100)} allocated.` });
    setOpenId(null);
    await onSubscribed();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-iris-500/25 bg-iris-500/10">
          <TrendingUp className="h-4.5 w-4.5 text-iris-300" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-white">Copy a strategy provider</h2>
          <p className="text-[12px] text-slate-500">Assign your balance to a provider.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {providers.length === 0 && (
          <p className="text-[13px] text-slate-500">No providers available yet.</p>
        )}
        {providers.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-ink-950"
                style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
              >
                {initialsOf(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13.5px] font-medium text-white">{p.name}</p>
                  {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-mint-400" />}
                </div>
                <p className="truncate text-[11.5px] text-slate-500">{p.strategy}</p>
              </div>
              <div className="text-right">
                <p className="tnum text-[13px] font-semibold text-mint-400">
                  +{Number(p.roi12m).toFixed(1)}%
                </p>
                <p className="text-[10.5px] text-slate-500">12M</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {openId === p.id ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 flex items-end gap-2 border-t border-white/[0.06] pt-3">
                    <Field label="Amount (KES)" htmlFor={`amt-${p.id}`} className="flex-1">
                      <Input
                        id={`amt-${p.id}`}
                        type="number"
                        min={1}
                        value={amount || ""}
                        onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value))))}
                        placeholder={`min ${(p.minInvestmentMinor / 100).toLocaleString()}`}
                      />
                    </Field>
                    <Button onClick={() => subscribe(p)} disabled={busy || amount <= 0} className="shrink-0">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Available: {ksh(balanceMinor)} · fee {(p.feeBps / 100).toFixed(0)}% of profit
                  </p>
                </motion.div>
              ) : (
                <button
                  onClick={() => {
                    setOpenId(p.id);
                    setAmount(0);
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-2 text-[12.5px] font-medium text-slate-200 transition-colors hover:bg-white/[0.07]"
                >
                  Subscribe
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Active allocations                                                         */
/* -------------------------------------------------------------------------- */

function Allocations({
  account,
  onChanged,
  pushToast,
}: {
  account: AccountSnapshot | null;
  onChanged: () => Promise<void>;
  pushToast: (t: { tone: "success" | "error" | "info"; title: string; body?: string }) => void;
}) {
  const active = (account?.allocations ?? []).filter((a) => a.status !== "closed");
  const [busyId, setBusyId] = useState<string | null>(null);
  if (active.length === 0) return null;

  const close = async (id: string) => {
    setBusyId(id);
    const res = await closeAllocation(id);
    setBusyId(null);
    if (res.ok) {
      pushToast({ tone: "success", title: "Unsubscribed", body: `${ksh(res.returnedMinor)} returned to your balance.` });
      await onChanged();
    } else {
      pushToast({ tone: "error", title: "Could not unsubscribe", body: res.error });
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-[15px] font-semibold text-white">Your subscriptions</h2>
      <div className="mt-4 space-y-2.5">
        {active.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-white">{a.provider.name}</p>
              <p className="truncate text-[11.5px] text-slate-500">{a.provider.strategy}</p>
            </div>
            <div className="text-right">
              <p className="tnum text-[13.5px] font-semibold text-white">{ksh(a.amountMinor)}</p>
              <button
                onClick={() => close(a.id)}
                disabled={busyId === a.id}
                className="text-[11.5px] font-medium text-rose-400 hover:text-rose-300"
              >
                {busyId === a.id ? "Closing…" : "Unsubscribe"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  History                                                                    */
/* -------------------------------------------------------------------------- */

function History({ account }: { account: AccountSnapshot | null }) {
  const payments = account?.payments ?? [];
  if (payments.length === 0) return null;

  const TONE: Record<string, "mint" | "amber" | "rose" | "slate"> = {
    completed: "mint",
    pending: "amber",
    initiated: "amber",
    failed: "rose",
    cancelled: "slate",
  };

  return (
    <Card className="p-6">
      <h2 className="text-[15px] font-semibold text-white">Transactions</h2>
      <div className="mt-4 space-y-1.5">
        {payments.slice(0, 10).map((p) => (
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
                  {new Date(p.createdAt).toLocaleString("en-KE")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("tnum text-[13px] font-semibold", p.kind === "deposit" ? "text-mint-400" : "text-white")}>
                {p.kind === "deposit" ? "+" : "-"}
                {ksh(p.amountMinor)}
              </p>
              <Badge tone={TONE[p.status] ?? "slate"}>{p.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
