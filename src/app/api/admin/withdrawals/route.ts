import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isAdminAuthed } from "@/server/adminAuth";
import { completeWithdrawal, listWithdrawals, rejectWithdrawal } from "@/server/payments";
import { accountNumber } from "@/lib/account";

const FLAG: Record<string, string> = {
  Kenya: "🇰🇪", Nigeria: "🇳🇬", "South Africa": "🇿🇦", Ghana: "🇬🇭", Tanzania: "🇹🇿",
  Uganda: "🇺🇬", "United Kingdom": "🇬🇧", UAE: "🇦🇪", India: "🇮🇳", Egypt: "🇪🇬",
};

/** Withdrawal queue for the admin console. */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await listWithdrawals(getDb());
  const withdrawals = rows.map((r) => ({
    id: r.payment.id,
    amountMinor: r.payment.amount,
    currency: r.payment.currency,
    provider: r.payment.provider,
    destination: r.payment.destination,
    status: r.payment.status,
    externalRef: r.payment.externalRef,
    createdAt: r.payment.createdAt,
    user: {
      id: r.user.id,
      name: `${r.user.firstName} ${r.user.lastName}`.trim(),
      email: r.user.email,
      phone: r.user.phone,
      flag: FLAG[r.user.country] ?? "🌐",
      kyc: r.user.kycStatusCache,
      account: accountNumber(r.user.id),
    },
  }));
  const pending = withdrawals.filter((w) => w.status === "pending").length;
  return NextResponse.json({ withdrawals, pending });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const paymentId = typeof body?.paymentId === "string" ? body.paymentId : "";
  const action = body?.action;
  if (!paymentId) return NextResponse.json({ error: "paymentId required" }, { status: 400 });

  const db = getDb();
  if (action === "complete") {
    const externalRef = typeof body?.externalRef === "string" ? body.externalRef : undefined;
    const res = await completeWithdrawal(db, { paymentId, externalRef });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "reject") {
    const reason = typeof body?.reason === "string" ? body.reason : undefined;
    const res = await rejectWithdrawal(db, { paymentId, reason });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
