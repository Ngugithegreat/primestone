"use client";

/** Client wrappers for the real money API (ledger-backed, Postgres). */

export type RealProvider = {
  id: string;
  name: string;
  handle: string;
  strategy: string;
  bio: string;
  country: string;
  roi12m: string;
  winRate: string;
  maxDrawdown: string;
  feeBps: number;
  minInvestmentMinor: number;
  verified: boolean;
};

export type RealAllocation = {
  id: string;
  amountMinor: number;
  status: "active" | "paused" | "closed";
  riskMultiplier: string;
  startedAt: string;
  provider: { id: string; name: string; strategy: string; roi12m: string };
};

export type RealPayment = {
  id: string;
  kind: "deposit" | "withdrawal";
  provider: string;
  amountMinor: number;
  feeMinor: number;
  status: "initiated" | "pending" | "completed" | "failed" | "cancelled";
  createdAt: string;
};

export type AccountSnapshot = {
  currency: string;
  balanceMinor: number;
  kycStatus: string;
  allocations: RealAllocation[];
  payments: RealPayment[];
};

export async function getAccount(): Promise<AccountSnapshot | null> {
  try {
    const res = await fetch("/api/account", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AccountSnapshot;
  } catch {
    return null;
  }
}

export async function getRealProviders(): Promise<RealProvider[]> {
  try {
    const res = await fetch("/api/providers", { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.providers ?? [];
  } catch {
    return [];
  }
}

export async function mpesaDeposit(input: { amount: number; phone?: string }) {
  const res = await fetch("/api/payments/mpesa/initiate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, error: data.error ?? "Deposit failed." };
  return { ok: true as const, paymentId: data.paymentId as string, message: data.message as string };
}

/** Ask the server to reconcile a pending M-Pesa deposit against Safaricom. */
export async function mpesaStatus(paymentId: string): Promise<"completed" | "failed" | "pending"> {
  try {
    const res = await fetch("/api/payments/mpesa/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    if (!res.ok) return "pending";
    const data = await res.json();
    return data.status ?? "pending";
  } catch {
    return "pending";
  }
}

export async function subscribeToProvider(input: {
  providerId: string;
  amount: number;
  riskMultiplier?: number;
  copyStopLossBps?: number | null;
}) {
  const res = await fetch("/api/allocations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, error: data.error ?? "Could not subscribe." };
  return { ok: true as const, allocationId: data.allocationId as string };
}

export async function closeAllocation(allocationId: string) {
  const res = await fetch("/api/allocations", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ allocationId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, error: data.error ?? "Could not close." };
  return { ok: true as const, returnedMinor: data.returnedMinor as number };
}

export function ksh(minor: number): string {
  return `KES ${(minor / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
