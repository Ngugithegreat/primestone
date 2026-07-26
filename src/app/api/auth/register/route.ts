import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { register } from "@/server/auth";
import { startSession } from "@/server/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await register(getDb(), body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await startSession(result.user.id);
  return NextResponse.json({ user: result.user });
}
