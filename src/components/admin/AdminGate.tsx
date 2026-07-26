"use client";

import { motion } from "framer-motion";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useAdminHydrated, useAdminStore } from "@/lib/adminStore";

/**
 * Passcode gate for the admin console.
 *
 * NOTE: this is a demonstration gate only. It runs entirely client-side, so it
 * is NOT real access control — a real admin area must authenticate against a
 * server and authorise by role. See the notes handed to the product owner.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const hydrated = useAdminHydrated();
  const authed = useAdminStore((s) => s.authed);
  const signIn = useAdminStore((s) => s.signIn);

  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-950">
        <LogoMark className="h-10 w-10 animate-pulse" />
      </div>
    );
  }

  if (authed) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn(code)) setError(true);
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink-950 px-5">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.14), transparent 60%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-sheen relative w-full max-w-sm rounded-2xl border border-white/[0.09] bg-ink-880/80 p-7 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-iris-500/25 bg-iris-500/10">
            <ShieldCheck className="h-5 w-5 text-iris-300" />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold text-white">Admin console</h1>
            <p className="text-[12.5px] text-slate-500">Staff access only</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Passcode" htmlFor="code" error={error ? "Incorrect passcode." : undefined}>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="code"
                type="password"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(false);
                }}
                placeholder="Enter admin passcode"
                className="pl-10"
                autoFocus
              />
            </div>
          </Field>
          <Button type="submit" className="w-full">
            <Lock className="h-4 w-4" />
            Unlock console
          </Button>
        </form>

        <p className="mt-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-slate-500">
          Demo access — passcode is{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-slate-300">primestone</code>. In
          production this screen authenticates staff against the server with role-based access.
        </p>
      </motion.div>
    </div>
  );
}
