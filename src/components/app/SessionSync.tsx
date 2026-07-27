"use client";

import { useEffect } from "react";
import { apiMe } from "@/lib/authClient";
import type { AccountTypeId } from "@/lib/accounts";
import { useHydrated, useStore } from "@/lib/store";

/**
 * Reconciles the server session (httpOnly cookie) with the client store on
 * load. The cookie is authoritative for real accounts:
 *   - a valid server session restores/refreshes the signed-in user, so a real
 *     login survives a refresh or a new device;
 *   - if the server says there is no session but the store thinks it is in a
 *     "real" session, the session expired → sign out locally.
 * Demo sessions (localStorage only) are left untouched.
 */
export function SessionSync() {
  const hydrated = useHydrated();
  const sessionMode = useStore((s) => s.sessionMode);
  const currentEmail = useStore((s) => s.user?.email);

  useEffect(() => {
    if (!hydrated) return;
    // Don't disturb a purely-local demo session.
    if (sessionMode === "demo") return;

    let cancelled = false;
    (async () => {
      const { ok, user } = await apiMe();
      if (cancelled || !ok) return;

      const store = useStore.getState();
      if (user) {
        if (user.email !== currentEmail || store.sessionMode !== "real") {
          store.signInReal({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            country: user.country,
            accountType: (user.accountType as AccountTypeId) ?? "standard",
            leverage: user.leverage,
            kycVerified: user.kycStatusCache === "verified",
          });
        }
      } else if (store.sessionMode === "real") {
        store.signOut();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, sessionMode, currentEmail]);

  return null;
}
