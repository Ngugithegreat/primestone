"use client";

import type { AccountTypeId } from "./accounts";

/**
 * Thin client-side wrappers around the real auth API (`/api/auth/*`).
 * These hit the server, which persists to Postgres and manages the httpOnly
 * session cookie. The response never includes the password hash.
 */

export type ApiUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  accountType: string;
  leverage: number;
  role: "client" | "admin" | "owner";
  kycStatusCache: "unverified" | "pending" | "verified" | "rejected";
};

type Ok = { ok: true; user: ApiUser };
type Err = { ok: false; error: string };

async function post(path: string, body?: unknown): Promise<Ok | Err> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong." };
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export function apiRegister(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  accountType: AccountTypeId;
  leverage: number;
}) {
  return post("/api/auth/register", input);
}

export function apiLogin(email: string, password: string) {
  return post("/api/auth/login", { email, password });
}

export async function apiLogout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
}

/**
 * Reads the current session. `ok:false` means the request itself failed
 * (network/server) — the caller should NOT treat that as "logged out", only a
 * successful `{ user: null }` means the server has no session.
 */
export async function apiMe(): Promise<{ ok: boolean; user: ApiUser | null }> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return { ok: false, user: null };
    const data = await res.json().catch(() => ({}));
    return { ok: true, user: data.user ?? null };
  } catch {
    return { ok: false, user: null };
  }
}
