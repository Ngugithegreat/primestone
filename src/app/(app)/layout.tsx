import { AppShell } from "@/components/app/AppShell";
import { CopyEngine } from "@/components/app/CopyEngine";
import { SessionSync } from "@/components/app/SessionSync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <SessionSync />
      <CopyEngine />
      {children}
    </AppShell>
  );
}
