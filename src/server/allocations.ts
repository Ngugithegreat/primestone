import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { allocations, ledgerAccounts, signalProviders } from "@/db/schema";
import {
  balanceOf,
  createAllocationAccount,
  ensureClientCashAccount,
  postWithin,
  toMinor,
} from "./ledger";

/**
 * Client allocations to signal providers.
 *
 * Allocating commits money: cash moves from the client's cash account into a
 * per-allocation account tied to the chosen provider. It is still the client's
 * money — a ledger transfer between their own accounts — but it is earmarked
 * and no longer spendable elsewhere until they deallocate. All movements go
 * through the ledger; nothing edits a balance directly.
 */

export async function allocate(
  db: Database,
  input: {
    userId: string;
    providerId: string;
    amount: number; // major units
    riskMultiplier?: number;
    copyStopLossBps?: number | null;
    currency?: string;
  },
): Promise<{ ok: true; allocationId: string } | { ok: false; error: string }> {
  const currency = input.currency ?? "USD";
  const amount = toMinor(input.amount);
  if (amount <= 0) return { ok: false, error: "Allocation amount must be positive." };

  const [provider] = await db
    .select()
    .from(signalProviders)
    .where(eq(signalProviders.id, input.providerId))
    .limit(1);
  if (!provider || !provider.active) return { ok: false, error: "Provider is not available." };
  if (amount < provider.minInvestment) {
    return {
      ok: false,
      error: `This provider's minimum is ${(provider.minInvestment / 100).toFixed(2)}.`,
    };
  }

  return db.transaction(async (tx) => {
    const cash = await ensureClientCashAccount(tx as unknown as Database, input.userId, currency);
    const available = await balanceOf(tx as unknown as Database, cash);
    if (amount > available) {
      return { ok: false as const, error: "Allocation exceeds your available balance." };
    }

    const allocAccount = await createAllocationAccount(
      tx as unknown as Database,
      input.userId,
      input.providerId,
      currency,
    );

    await postWithin(tx as unknown as Database, {
      kind: "allocation",
      reference: `allocation:${input.userId}:${input.providerId}:${Date.now()}`,
      memo: `Allocate to ${provider.name}`,
      createdBy: input.userId,
      currency,
      legs: [
        { accountId: cash, amount: -amount },
        { accountId: allocAccount, amount },
      ],
    });

    const [row] = await tx
      .insert(allocations)
      .values({
        userId: input.userId,
        providerId: input.providerId,
        amount,
        riskMultiplier: String(input.riskMultiplier ?? 1),
        copyStopLossBps: input.copyStopLossBps ?? null,
      })
      .returning({ id: allocations.id });

    return { ok: true as const, allocationId: row!.id };
  });
}

/** Close an allocation and return its remaining funds to spendable cash. */
export async function deallocate(
  db: Database,
  input: { userId: string; allocationId: string; currency?: string },
): Promise<{ ok: true; returned: number } | { ok: false; error: string }> {
  const currency = input.currency ?? "USD";

  return db.transaction(async (tx) => {
    const [alloc] = await tx
      .select()
      .from(allocations)
      .where(
        and(eq(allocations.id, input.allocationId), eq(allocations.userId, input.userId)),
      )
      .limit(1);
    if (!alloc) return { ok: false as const, error: "Allocation not found." };
    if (alloc.status === "closed") return { ok: false as const, error: "Allocation already closed." };

    // Find this allocation's account and return whatever remains in it.
    const [allocAccount] = await tx
      .select({ id: ledgerAccounts.id })
      .from(ledgerAccounts)
      .where(
        and(
          eq(ledgerAccounts.kind, "client_allocation"),
          eq(ledgerAccounts.userId, input.userId),
          eq(ledgerAccounts.providerId, alloc.providerId),
        ),
      )
      .orderBy(desc(ledgerAccounts.createdAt))
      .limit(1);
    if (!allocAccount) return { ok: false as const, error: "Allocation account missing." };

    const remaining = await balanceOf(tx as unknown as Database, allocAccount.id);
    const cash = await ensureClientCashAccount(tx as unknown as Database, input.userId, currency);

    if (remaining !== 0) {
      await postWithin(tx as unknown as Database, {
        kind: "deallocation",
        reference: `deallocation:${input.allocationId}:${Date.now()}`,
        memo: "Close allocation",
        createdBy: input.userId,
        currency,
        legs: [
          { accountId: allocAccount.id, amount: -remaining },
          { accountId: cash, amount: remaining },
        ],
      });
    }

    await tx
      .update(allocations)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(allocations.id, input.allocationId));

    return { ok: true as const, returned: remaining };
  });
}

export async function listAllocations(db: Database, userId: string) {
  return db
    .select({
      allocation: allocations,
      provider: signalProviders,
    })
    .from(allocations)
    .innerJoin(signalProviders, eq(allocations.providerId, signalProviders.id))
    .where(eq(allocations.userId, userId))
    .orderBy(desc(allocations.startedAt));
}
