"use client";

import { useCallback, useEffect, useState } from "react";
import { getAccount, type AccountSnapshot } from "./accountClient";
import { useStore } from "./store";

/**
 * Live view of the user's REAL (ledger-backed) account for authenticated
 * sessions: cash balance, allocations and payments, refreshed periodically.
 * Returns nulls for demo sessions.
 */
export function useRealAccount(pollMs = 20000) {
  const sessionMode = useStore((s) => s.sessionMode);
  const isReal = sessionMode === "real";
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [loading, setLoading] = useState(isReal);

  const refresh = useCallback(async () => {
    if (!isReal) return;
    const acc = await getAccount();
    setAccount(acc);
    setLoading(false);
  }, [isReal]);

  useEffect(() => {
    if (!isReal) {
      setAccount(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const acc = await getAccount();
      if (!cancelled) {
        setAccount(acc);
        setLoading(false);
      }
    };
    run();
    const id = window.setInterval(run, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isReal, pollMs]);

  const balanceMinor = account?.balanceMinor ?? 0;
  const allocatedMinor = (account?.allocations ?? [])
    .filter((a) => a.status !== "closed")
    .reduce((s, a) => s + a.amountMinor, 0);
  const hasDeposited = (account?.payments ?? []).some(
    (p) => p.kind === "deposit" && p.status === "completed",
  );

  return {
    isReal,
    loading,
    account,
    balanceMinor,
    allocatedMinor,
    totalMinor: balanceMinor + allocatedMinor,
    hasDeposited,
    // "Live" once real money has landed; before that it's a funded practice account.
    isLive: isReal && (hasDeposited || balanceMinor > 0 || allocatedMinor > 0),
    refresh,
  };
}
