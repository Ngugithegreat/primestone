"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Badge, Card } from "@/components/ui/Primitives";
import { usd, withdrawRequest } from "@/lib/accountClient";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Withdraw funds (Portfolio). The form is always fillable; at submit we require
 * a verified identity and sufficient funds. Unverified users are shown a clean
 * verification step before the request can go through.
 */
export function WithdrawPanel({
  balanceMinor,
  kycStatus,
  onDone,
}: {
  balanceMinor: number;
  kycStatus: string;
  onDone: () => Promise<void>;
}) {
  const userPhone = useStore((s) => s.user?.phone ?? "");
  const verified = kycStatus === "verified";
  const maxUsd = Math.floor(balanceMinor / 100);

  const [amount, setAmount] = useState<number>(0);
  const [phone, setPhone] = useState(userPhone);
  const [state, setState] = useState<"idle" | "busy" | "verify" | "done">("idle");
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  const noFunds = maxUsd <= 0;

  const submit = async () => {
    setError(undefined);
    if (noFunds) return setError("You have no funds available to withdraw.");
    if (amount <= 0) return setError("Enter an amount to withdraw.");
    if (amount > maxUsd) return setError(`You can withdraw up to ${usd(balanceMinor)}.`);
    if (!/^(\+?254|0)\d{9}$/.test(phone.replace(/\s+/g, ""))) {
      return setError("Enter a valid Safaricom number.");
    }
    // Identity check happens at submit — an unverified account is asked to verify.
    if (!verified) return setState("verify");

    setState("busy");
    const res = await withdrawRequest({ amount, phone });
    if (!res.ok) {
      setState("idle");
      setError(res.error);
      return;
    }
    setState("done");
    setMessage(`We&rsquo;ll send ${usd(amount * 100)} to ${phone} shortly.`);
    await onDone();
  };

  return (
    <Card className="card-sheen overflow-hidden p-0">
      <div className="relative p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full blur-[70px]"
          style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.18), transparent 70%)" }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-iris-500/25 bg-iris-500/10">
              <ArrowUpRight className="h-4.5 w-4.5 text-iris-300" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-white">Withdraw funds</h2>
              <p className="text-[12px] text-slate-500">Cash out to your M-Pesa.</p>
            </div>
          </div>
          {verified ? (
            <Badge tone="mint">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge tone="amber">
              <ShieldAlert className="h-3 w-3" />
              Verification required
            </Badge>
          )}
        </div>

        {/* ---- Verify step (shown after submit when unverified) ------------- */}
        {state === "verify" ? (
          <div className="relative mt-5 grid place-items-center rounded-2xl border border-amber-450/25 bg-amber-450/[0.05] px-5 py-9 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-450/12">
              <ShieldAlert className="h-7 w-7 text-amber-400" />
            </span>
            <p className="mt-4 text-[15px] font-semibold text-white">Verify your identity to withdraw</p>
            <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-slate-400">
              Your withdrawal of <span className="font-semibold text-white">{usd(amount * 100)}</span> is
              ready. For your security and to meet compliance rules, we need to confirm your identity
              first — it takes about a minute.
            </p>
            <div className="mt-5 flex gap-2.5">
              <Button variant="ghost" size="sm" onClick={() => setState("idle")}>
                Back
              </Button>
              <Link
                href="/verify"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-xl bg-mint-500 px-4 text-[13px] font-semibold text-ink-950 hover:bg-mint-400"
              >
                Verify identity
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : state === "done" ? (
          <div className="relative mt-5 grid place-items-center rounded-2xl border border-mint-500/25 bg-mint-500/[0.07] px-5 py-9 text-center">
            <CheckCircle2 className="h-10 w-10 text-mint-400" />
            <p className="mt-3 text-[15px] font-semibold text-white">Withdrawal requested</p>
            <p className="mt-1 text-[13px] text-slate-400">
              We&rsquo;ll send {usd(amount * 100)} to {phone} shortly.
            </p>
            <button
              onClick={() => {
                setState("idle");
                setAmount(0);
              }}
              className="mt-4 text-[13px] font-medium text-mint-400 hover:text-mint-300"
            >
              Make another request
            </button>
          </div>
        ) : (
          /* ---- Form ------------------------------------------------------- */
          <div className="relative mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <span className="text-[12px] text-slate-500">Available to withdraw</span>
              <span className="tnum text-[14px] font-semibold text-white">{usd(balanceMinor)}</span>
            </div>

            <Field label="Amount (USD)" htmlFor="wd-amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400">
                  $
                </span>
                <Input
                  id="wd-amount"
                  type="number"
                  min={0}
                  max={maxUsd}
                  value={amount || ""}
                  onChange={(e) => {
                    setAmount(Math.max(0, Math.round(Number(e.target.value))));
                    setError(undefined);
                  }}
                  disabled={state === "busy" || noFunds}
                  className="pl-7"
                  placeholder="0"
                />
                {!noFunds && (
                  <button
                    type="button"
                    onClick={() => setAmount(maxUsd)}
                    className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/[0.1]"
                  >
                    Max
                  </button>
                )}
              </div>
            </Field>

            <Field label="M-Pesa phone" htmlFor="wd-phone" hint="Safaricom number">
              <Input
                id="wd-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                disabled={state === "busy"}
              />
            </Field>

            {error && (
              <p className="text-[12.5px] text-rose-400">{error}</p>
            )}

            {!verified && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-450/25 bg-amber-450/[0.06] p-3 text-[12px] text-amber-300">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                You can fill this in now, but withdrawals require a verified account — you&rsquo;ll be
                asked to verify before it&rsquo;s submitted.
              </div>
            )}

            <Button onClick={submit} disabled={state === "busy" || noFunds} className="w-full">
              {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />}
              {noFunds
                ? "No funds to withdraw"
                : amount > 0
                  ? `Request withdrawal · $${amount.toLocaleString()}`
                  : "Request withdrawal"}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
