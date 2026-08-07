"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthLayout } from "./AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { useStore } from "@/lib/store";
import { apiLogin, apiMe } from "@/lib/authClient";
import type { AccountTypeId } from "@/lib/accounts";

export function LoginForm() {
  const router = useRouter();
  const signInReal = useStore((s) => s.signInReal);
  const pushToast = useStore((s) => s.pushToast);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Skip the form ONLY if the server confirms a live session cookie — never
  // based on client-side/localStorage state. A logged-out visitor always has
  // to enter their password here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { user: serverUser } = await apiMe();
      if (cancelled || !serverUser) return;
      signInReal({
        firstName: serverUser.firstName,
        lastName: serverUser.lastName,
        email: serverUser.email,
        phone: serverUser.phone,
        country: serverUser.country,
        accountType: (serverUser.accountType as AccountTypeId) ?? "standard",
        leverage: serverUser.leverage,
        kycVerified: serverUser.kycStatusCache === "verified",
      });
      router.replace("/dashboard");
    })();
    return () => {
      cancelled = true;
    };
  }, [router, signInReal]);

  const submit = async (e: React.FormEvent) => {
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
    const result = await apiLogin(email.trim().toLowerCase(), password);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    signInReal({
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      email: result.user.email,
      phone: result.user.phone,
      country: result.user.country,
      accountType: (result.user.accountType as AccountTypeId) ?? "standard",
      leverage: result.user.leverage,
      kycVerified: result.user.kycStatusCache === "verified",
    });
    pushToast({ tone: "success", title: "Welcome back", body: "Your desk is ready." });
    router.push("/dashboard");
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your desk to check your copies, positions and balance."
      footer={
        <>
          New to PrimeStone?{" "}
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
            <Link href="/forgot-password" className="text-mint-400 hover:text-mint-300">
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

        <p className="pt-1 text-center text-[12px] leading-relaxed text-slate-500">
          Protected by 256-bit encryption. Enable two-factor authentication in settings
          for an extra layer of security on sign-in and withdrawals.
        </p>
      </form>
    </AuthLayout>
  );
}
