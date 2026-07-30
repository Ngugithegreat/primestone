import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { clientCashBalance } from "@/server/ledger";
import { listAllocations } from "@/server/allocations";
import { listPayments } from "@/server/payments";

/** Real account snapshot for the signed-in user: cash, allocations, payments. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const [cashMinor, allocations, payments] = await Promise.all([
    clientCashBalance(db, user.id),
    listAllocations(db, user.id),
    listPayments(db, user.id),
  ]);

  return NextResponse.json({
    currency: "USD",
    balanceMinor: cashMinor,
    kycStatus: user.kycStatusCache,
    allocations: allocations.map((a) => ({
      id: a.allocation.id,
      amountMinor: a.allocation.amount,
      status: a.allocation.status,
      riskMultiplier: a.allocation.riskMultiplier,
      startedAt: a.allocation.startedAt,
      provider: {
        id: a.provider.id,
        name: a.provider.name,
        strategy: a.provider.strategy,
        roi12m: a.provider.roi12m,
      },
    })),
    payments: payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      provider: p.provider,
      // USD that hit the account (falls back to charged amount for older rows).
      amountMinor: p.creditedAmount ?? p.amount,
      chargedAmountMinor: p.amount,
      chargedCurrency: p.currency,
      feeMinor: p.feeAmount,
      status: p.status,
      createdAt: p.createdAt,
    })),
  });
}
