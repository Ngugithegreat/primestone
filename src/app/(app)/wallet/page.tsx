import type { Metadata } from "next";
import { WalletView } from "@/components/app/WalletView";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Deposit with M-Pesa, crypto or card, and withdraw your balance.",
};

export default function WalletPage() {
  return <WalletView />;
}
