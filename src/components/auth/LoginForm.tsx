"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Fingerprint } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useHydrated, useStore } from "@/lib/store";

export function LoginForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useStore((s) => s.user);
  const signIn = useStore((s) => s.signIn);
  const pushToast = useStore((s) => s.pushToast);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // An existing session skips the form entirely.
  useEffect(() => {
    if (hydrated && user) router.replace("/dashboard");
  }, [hydrated, user, router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);
    setError(undefined);
    window.setTimeout(() => {
      signIn(email.trim().toLowerCase());
      pushToast({ tone: "success", title: "Welcome back", body: "Your desk is ready." });
      router.push("/dashboard");
    }, 550);
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your desk to check your copies, positions and balance."
      footer={
        <>
          New to AlphaSync?{" "}
          <Link href="/signup" className="font-medium text-mint-400 hover:text-mint-300">
            Open a free account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address" htmlFor="email" error={error}>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          hint={
            <Link href="/login" className="text-mint-400 hover:text-mint-300">
              Forgot?
            </Link>
          }
        >
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-white/[0.08]" />
          <span className="text-[11.5px] uppercase tracking-[0.14em] text-slate-600">or</span>
          <span className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <button
          type="button"
          onClick={() => {
            signIn("demo@alphasync.com");
            pushToast({
              tone: "info",
              title: "Demo session started",
              body: "A funded demo account has been loaded for you.",
            });
            router.push("/dashboard");
          }}
          className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-[14px] font-medium text-white transition-colors hover:bg-white/[0.09]"
        >
          <Fingerprint className="h-4 w-4 text-mint-400" />
          Continue with a demo account
        </button>

        <p className="pt-1 text-center text-[12px] leading-relaxed text-slate-500">
          This is a demonstration platform. Any email and password will sign you in to a
          simulated account — no real credentials are stored or transmitted.
        </p>
      </form>
    </AuthLayout>
  );
}
