"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  buildDemoUsers,
  type AdminUser,
  type KycStatus,
} from "./kyc";

/* -------------------------------------------------------------------------- */
/*  Admin console store                                                        */
/*                                                                             */
/*  Holds the seeded operator directory and the review actions. The live       */
/*  signed-in session is merged in separately by the console component so an    */
/*  operator can approve their own real submission during a walkthrough — that  */
/*  cross-store write goes through the main store's `reviewKyc`.                */
/* -------------------------------------------------------------------------- */

const ADMIN_PASSCODE = "primestone"; // demo gate only — NOT real access control

type AdminState = {
  hydrated: boolean;
  authed: boolean;
  users: AdminUser[];
};

type AdminActions = {
  signIn: (passcode: string) => boolean;
  signOut: () => void;
  approve: (id: string) => void;
  reject: (id: string, reason: string) => void;
  toggleFlag: (id: string) => void;
  reseed: () => void;
};

export type AdminStore = AdminState & AdminActions;

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      hydrated: false,
      authed: false,
      users: buildDemoUsers(),

      signIn: (passcode) => {
        const ok = passcode.trim().toLowerCase() === ADMIN_PASSCODE;
        if (ok) set({ authed: true });
        return ok;
      },

      signOut: () => set({ authed: false }),

      approve: (id) =>
        set({
          users: get().users.map((u) =>
            u.id === id
              ? {
                  ...u,
                  kyc: {
                    ...u.kyc,
                    status: "verified",
                    reviewedAt: Date.now(),
                    reviewedBy: "compliance@primestone.com",
                    rejectionReason: null,
                  },
                }
              : u,
          ),
        }),

      reject: (id, reason) =>
        set({
          users: get().users.map((u) =>
            u.id === id
              ? {
                  ...u,
                  kyc: {
                    ...u.kyc,
                    status: "rejected",
                    reviewedAt: Date.now(),
                    reviewedBy: "compliance@primestone.com",
                    rejectionReason: reason,
                  },
                }
              : u,
          ),
        }),

      toggleFlag: (id) =>
        set({
          users: get().users.map((u) => (u.id === id ? { ...u, flagged: !u.flagged } : u)),
        }),

      reseed: () => set({ users: buildDemoUsers() }),
    }),
    {
      name: "primestone.admin.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ authed: s.authed, users: s.users }),
      onRehydrateStorage: () => () => {
        useAdminStore.setState({ hydrated: true });
      },
    },
  ),
);

export function useAdminHydrated() {
  const hydrated = useAdminStore((s) => s.hydrated);
  useEffect(() => {
    if (!useAdminStore.getState().hydrated) useAdminStore.setState({ hydrated: true });
  }, []);
  return hydrated;
}

export const STATUS_FILTERS: { id: KycStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "unverified", label: "Not started" },
];
