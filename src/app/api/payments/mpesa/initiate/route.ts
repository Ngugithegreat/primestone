import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { currentUser } from "@/server/session";
import { initiateDeposit } from "@/server/payments";
import { isMpesaConfigured, normalizeMsisdn, stkPush } from "@/server/mpesa";
import { kesToUsdMinor } from "@/server/fx";

/**
 * Start an M-Pesa deposit: send an STK Push to the customer's phone. The money
 * is credited only later, from the callback — this just kicks off the prompt
 * and records a pending payment keyed on the CheckoutRequestID.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isMpesaConfigured()) {
    return NextResponse.json(
      { error: "M-Pesa is not configured on the server yet." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => null);
  const amount = Math.round(Number(body?.amount)); // whole KES
  const phoneRaw = typeof body?.phone === "string" && body.phone ? body.phone : user.phone;

  if (!Number.isFinite(amount) || amount < 1) {
    return NextResponse.json({ error: "Enter a valid amount in KES." }, { status: 400 });
  }
  const phone = normalizeMsisdn(phoneRaw ?? "");
  if (!/^2547\d{8}$|^2541\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid Safaricom phone number." }, { status: 400 });
  }

  const push = await stkPush({
    phone,
    amount,
    accountReference: `PS${user.id.slice(0, 8)}`,
    description: "PrimeStone deposit",
  });
  if (!push.ok) return NextResponse.json({ error: push.error }, { status: 502 });

  // Lock the FX rate now: the client pays KES, the account is credited in USD.
  const { usdMinor, rate } = await kesToUsdMinor(amount * 100);

  // Record the pending deposit against the CheckoutRequestID the callback carries.
  const paymentId = await initiateDeposit(getDb(), {
    userId: user.id,
    provider: "mpesa",
    amount,
    currency: "KES",
    creditedAmount: usdMinor,
    fxRate: rate,
    providerRequestId: push.checkoutRequestId,
    destination: phone,
  });

  return NextResponse.json({
    ok: true,
    paymentId,
    checkoutRequestId: push.checkoutRequestId,
    message: push.customerMessage,
  });
}
