import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { allocations, copyPositions, ledgerAccounts, users } from "@/db/schema";
import {
  balanceOf,
  ensureClientCashAccount,
  ensureSystemAccount,
  postWithin,
  toMinor,
} from "./ledger";

/**
 * TESTING-ONLY utilities — fund a test account without a real payment, and
 * instantly "blow" allocated accounts to demonstrate that losses/blow-ups work.
 * Remove this module (and /api/admin/test) before public launch.
 */

/** Credit a user's real cash balance with test funds (no PSP involved). */
export async function testCredit(
  db: Database,
  email: string,
  amountMajor: number,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const amount = toMinor(amountMajor);
  if (!(amount > 0)) return { ok: false, error: "Amount must be positive." };
  const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  if (!u) return { ok: false, error: `No user with email ${email}.` };

  await db.transaction(async (tx) => {
    const clearing = await ensureSystemAccount(tx as unknown as Database, "system_deposits_clearing", "USD");
    const cash = await ensureClientCashAccount(tx as unknown as Database, u.id, "USD");
    await postWithin(tx as unknown as Database, {
      kind: "adjustment",
      reference: `test-credit:${u.id}:${Date.now()}`,
      memo: "TEST funds (no real payment)",
      createdBy: u.id,
      currency: "USD",
      legs: [
        { accountId: clearing, amount: -amount },
        { accountId: cash, amount },
      ],
    });
  });
  return { ok: true, name: `${u.firstName} ${u.lastName}`.trim() || u.email };
}

/**
 * Instantly blow every active allocation (or one user's): drain each allocation
 * account to $0 as a loss and close its open positions. Simulates a wiped
 * account so you can confirm the blow-up flow works.
 */
export async function blowAllocations(
  db: Database,
  email?: string,
): Promise<{ ok: true; blown: number }> {
  let userId: string | undefined;
  if (email) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    userId = u?.id;
    if (!userId) return { ok: true, blown: 0 };
  }

  const allocs = await db
    .select()
    .from(allocations)
    .where(
      userId
        ? and(eq(allocations.status, "active"), eq(allocations.userId, userId))
        : eq(allocations.status, "active"),
    );

  let blown = 0;
  for (const a of allocs) {
    await db.transaction(async (tx) => {
      const [acc] = await tx
        .select({ id: ledgerAccounts.id })
        .from(ledgerAccounts)
        .where(
          and(
            eq(ledgerAccounts.kind, "client_allocation"),
            eq(ledgerAccounts.userId, a.userId),
            eq(ledgerAccounts.providerId, a.providerId),
          ),
        )
        .orderBy(desc(ledgerAccounts.createdAt))
        .limit(1);
      if (!acc) return;
      const bal = await balanceOf(tx as unknown as Database, acc.id);
      if (bal <= 0) return;

      const systemPnl = await ensureSystemAccount(tx as unknown as Database, "system_pnl", "USD");
      await postWithin(tx as unknown as Database, {
        kind: "trade_pnl",
        reference: `test-blow:${a.id}:${Date.now()}`,
        memo: "TEST blow-up — account wiped",
        createdBy: a.userId,
        currency: "USD",
        legs: [
          { accountId: acc.id, amount: -bal },
          { accountId: systemPnl, amount: bal },
        ],
      });
      await tx
        .update(copyPositions)
        .set({ status: "closed", realizedPnl: 0, closedAt: new Date() })
        .where(and(eq(copyPositions.allocationId, a.id), eq(copyPositions.status, "open")));
      await tx
        .update(allocations)
        .set({ realizedPnl: sql`${allocations.realizedPnl} - ${bal}` })
        .where(eq(allocations.id, a.id));
      blown++;
    });
  }
  return { ok: true, blown };
}
