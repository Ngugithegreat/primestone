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
  amountMinor: number; // committed principal
  valueMinor: number; // live value: principal + settled P&L
  status: "active" | "paused" | "closed";
  riskMultiplier: string;
  startedAt: string;
  provider: { id: string; name: string; strategy: string; roi12m: string };
};

export type RealPayment = {
  id: string;
  kind: "deposit" | "withdrawal";
  provider: string;
  amountMinor: number; // USD credited
  chargedAmountMinor?: number; // what was charged (e.g. KES)
  chargedCurrency?: string;
  feeMinor: number;
  status: "initiated" | "pending" | "completed" | "failed" | "cancelled";
  createdAt: string;
};

export type RealOpenPosition = {
  id: string;
  symbol: string;
  label: string;
  side: "buy" | "sell";
  entryPrice: number;
  stakeMinor: number;
  provider: string;
  openedAt: string;
};

export type AccountSnapshot = {
  currency: string;
  balanceMinor: number;
  kycStatus: string;
  allocations: RealAllocation[];
  payments: RealPayment[];
  realizedPnlMinor: number;
  openPositions: RealOpenPosition[];
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

export async function mpesaDeposit(input: { amountUsd: number; phone?: string }) {
  const res = await fetch("/api/payments/mpesa/initiate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, error: data.error ?? "Deposit failed." };
  return { ok: true as const, paymentId: data.paymentId as string, message: data.message as string };
}


export type MpesaStatus = {
  status: "completed" | "failed" | "pending";
  /** Safaricom's own reason on failure (e.g. "Request cancelled by user"). */
  detail?: string;
  /** Safaricom ResultCode on failure (e.g. "1032"). */
  code?: string;
};

/** Ask the server to reconcile a pending M-Pesa deposit against Safaricom. */
export async function mpesaStatus(paymentId: string): Promise<MpesaStatus> {
  try {
    const res = await fetch("/api/payments/mpesa/status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    if (!res.ok) return { status: "pending" };
    const data = await res.json();
    return { status: data.status ?? "pending", detail: data.detail, code: data.code };
  } catch {
    return { status: "pending" };
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

export async function withdrawRequest(input: { amount: number; phone?: string }) {
  const res = await fetch("/api/payments/withdraw", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, error: data.error ?? "Withdrawal failed." };
  return { ok: true as const, paymentId: data.paymentId as string };
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

/** Format USD minor units (cents) as $. The real account is denominated in USD. */
export function usd(minor: number): string {
  return `$${(minor / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format KES minor units — used only on the deposit form (M-Pesa charges KES). */
export function ksh(minor: number): string {
  return `KES ${(minor / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Current USD→KES rate for the deposit estimate. */
export async function getUsdKesRate(): Promise<number> {
  try {
    const res = await fetch("/api/fx/rate", { cache: "no-store" });
    const data = await res.json();
    return data.usdKes ?? 129;
  } catch {
    return 129;
  }
}

/** Real, live quotes for the given instruments (for marking open positions). */
export async function getQuotes(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  try {
    const q = encodeURIComponent(symbols.join(","));
    const res = await fetch(`/api/market/quotes?symbols=${q}`, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    return (data.quotes ?? {}) as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * Unrealized P&L on an open copied position at a live price, in USD minor units.
 * Mirrors the server's `positionPnl`: return on the staked amount, clamped so a
 * position can't show a loss deeper than its stake.
 */
export function unrealizedPnlMinor(
  pos: RealOpenPosition,
  price: number | undefined,
): number | null {
  if (price == null || !(pos.entryPrice > 0)) return null;
  const dir = pos.side === "buy" ? 1 : -1;
  const raw = Math.round(pos.stakeMinor * ((price - pos.entryPrice) / pos.entryPrice) * dir);
  return Math.max(raw, -pos.stakeMinor);
}
