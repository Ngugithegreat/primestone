import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { isAdminAuthed } from "@/server/adminAuth";
import { getRiskPct, setRiskPct } from "@/server/settings";

/** Read/update runtime engine settings (currently: risk per trade). */
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const riskPct = await getRiskPct(getDb());
  return NextResponse.json({ riskPct });
}

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const riskPct = Number(body?.riskPct);
  if (!Number.isFinite(riskPct) || riskPct <= 0) {
    return NextResponse.json({ error: "Enter a valid risk %." }, { status: 400 });
  }
  const saved = await setRiskPct(getDb(), riskPct);
  return NextResponse.json({ ok: true, riskPct: saved });
}
