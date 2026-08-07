import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { requestWithdrawal } from "@/server/payments";
import { normalizeMsisdn } from "@/server/mpesa";

/**
 * Request a withdrawal to M-Pesa. KYC-gated (enforced in requestWithdrawal).
 * Funds are locked immediately (debited to the withdrawals-clearing account);
 * an operator sends the money out of band and marks it paid in the admin queue.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount); // USD, major units
  const phoneRaw = typeof body?.phone === "string" && body.phone ? body.phone : user.phone;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }
  const phone = normalizeMsisdn(phoneRaw ?? "");
  if (!/^2547\d{8}$|^2541\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid Safaricom number to receive the funds." }, { status: 400 });
  }

  const res = await requestWithdrawal(getDb(), {
    userId: user.id,
    provider: "mpesa",
    amount,
    fee: 0,
    destination: phone,
    currency: "USD",
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true, paymentId: res.paymentId });
}
