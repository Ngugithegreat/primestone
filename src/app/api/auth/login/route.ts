import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { login } from "@/server/auth";
import { startSession } from "@/server/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const result = await login(getDb(), email, password);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  await startSession(result.user.id);
  return NextResponse.json({ user: result.user });
}
