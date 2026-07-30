import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { payments, users } from "@/db/schema";
import {
  ensureClientCashAccount,
  ensureSystemAccount,
  postWithin,
  toMinor,
} from "./ledger";

/**
 * Payments.
 *
 * A deposit is only credited to a client's cash account from a CONFIRMED
 * payment — never from a browser response. The PSP's reference (e.g. an M-Pesa
 * receipt) is stored under a unique constraint, so a retried or duplicated
 * callback can never credit the account twice.
 *
 * The M-Pesa/card/crypto network calls live in the route handlers that call
 * these functions; here we own the state machine and the ledger effects.
 */

type Provider = "mpesa" | "card" | "crypto" | "bank";

/** Record a deposit intent (before the PSP confirms). Returns the payment id. */
export async function initiateDeposit(
  db: Database,
  input: {
    userId: string;
    provider: Provider;
    amount: number; // charged amount, major units (e.g. KES)
    currency?: string; // currency of `amount`
    /** USD minor units to credit on confirmation (after FX). Defaults to the charged amount. */
    creditedAmount?: number;
    fxRate?: number;
    providerRequestId?: string;
    destination?: string;
  },
): Promise<string> {
  if (input.amount <= 0) throw new Error("Deposit amount must be positive.");
  const [row] = await db
    .insert(payments)
    .values({
      userId: input.userId,
      provider: input.provider,
      kind: "deposit",
      amount: toMinor(input.amount),
      currency: input.currency ?? "USD",
      creditedAmount: input.creditedAmount ?? toMinor(input.amount),
      fxRate: input.fxRate != null ? String(input.fxRate) : null,
      status: "pending",
      providerRequestId: input.providerRequestId,
      destination: input.destination,
    })
    .returning({ id: payments.id });
  return row!.id;
}

/**
 * Confirm a deposit from a PSP callback and credit the client's cash.
 *
 * Idempotent: keyed on `externalRef`. If a payment with that reference is
 * already completed, this is a no-op and returns `alreadyProcessed: true`.
 */
export async function confirmDeposit(
  db: Database,
  input: {
    paymentId: string;
    externalRef: string;
    rawCallback?: unknown;
  },
): Promise<{ ok: boolean; alreadyProcessed: boolean }> {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.id, input.paymentId))
      .limit(1);
    if (!payment) throw new Error("Payment not found.");
    if (payment.status === "completed") return { ok: true, alreadyProcessed: true };

    // A different payment already used this receipt → duplicate callback.
    const dupe = await tx
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.externalRef, input.externalRef))
      .limit(1);
    if (dupe[0] && dupe[0].id !== input.paymentId) {
      return { ok: false, alreadyProcessed: true };
    }

    // The account is denominated in USD; credit the converted amount.
    const creditMinor = payment.creditedAmount ?? payment.amount;
    const clearing = await ensureSystemAccount(tx as unknown as Database, "system_deposits_clearing", "USD");
    const cash = await ensureClientCashAccount(tx as unknown as Database, payment.userId, "USD");

    const txnId = await postWithin(tx as unknown as Database, {
      kind: "deposit",
      reference: `deposit:${input.externalRef}`,
      memo: `${payment.provider} deposit (${payment.amount / 100} ${payment.currency})`,
      metadata: { paymentId: payment.id, fxRate: payment.fxRate },
      createdBy: payment.userId,
      currency: "USD",
      legs: [
        { accountId: clearing, amount: -creditMinor },
        { accountId: cash, amount: creditMinor },
      ],
    });

    await tx
      .update(payments)
      .set({
        status: "completed",
        externalRef: input.externalRef,
        rawCallback: (input.rawCallback ?? null) as object | null,
        ledgerTransactionId: txnId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    return { ok: true, alreadyProcessed: false };
  });
}

/**
 * Request a withdrawal. Hard-gated on KYC: an unverified account cannot move
 * money out. Debits cash immediately into a withdrawals clearing account; the
 * payout to the PSP is settled separately.
 */
export async function requestWithdrawal(
  db: Database,
  input: {
    userId: string;
    provider: Provider;
    amount: number; // major units
    fee?: number; // major units
    destination: string;
    currency?: string;
  },
): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  const currency = input.currency ?? "USD";
  const amount = toMinor(input.amount);
  const fee = toMinor(input.fee ?? 0);

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) return { ok: false, error: "User not found." };
  if (user.kycStatusCache !== "verified") {
    return { ok: false, error: "Identity verification is required before withdrawing." };
  }
  if (amount <= 0) return { ok: false, error: "Withdrawal amount must be positive." };

  return db.transaction(async (tx) => {
    const cash = await ensureClientCashAccount(tx as unknown as Database, input.userId, currency);
    const clearing = await ensureSystemAccount(tx as unknown as Database, "system_withdrawals_clearing", currency);
    const feeAcct = await ensureSystemAccount(tx as unknown as Database, "system_fees", currency);

    // Balance check inside the transaction to avoid a race.
    const { balanceOf } = await import("./ledger");
    const available = await balanceOf(tx as unknown as Database, cash);
    if (amount + fee > available) {
      return { ok: false as const, error: "Amount plus fee exceeds your available balance." };
    }

    const legs = [
      { accountId: cash, amount: -(amount + fee) },
      { accountId: clearing, amount },
    ];
    if (fee > 0) legs.push({ accountId: feeAcct, amount: fee });

    const txnId = await postWithin(tx as unknown as Database, {
      kind: "withdrawal",
      reference: `withdrawal:${input.userId}:${Date.now()}`,
      memo: `${input.provider} withdrawal`,
      createdBy: input.userId,
      currency,
      legs,
    });

    const [row] = await tx
      .insert(payments)
      .values({
        userId: input.userId,
        provider: input.provider,
        kind: "withdrawal",
        amount,
        feeAmount: fee,
        currency,
        status: "pending",
        destination: input.destination,
        ledgerTransactionId: txnId,
      })
      .returning({ id: payments.id });

    return { ok: true as const, paymentId: row!.id };
  });
}

export async function listPayments(db: Database, userId: string) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));
}
