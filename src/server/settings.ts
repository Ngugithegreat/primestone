import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog } from "@/db/schema";

/**
 * Lightweight runtime settings, stored as the latest audit-log entry for a key
 * (so there's no extra table/migration — it works the moment it deploys, and
 * keeps a full history of who changed what). Cached in-process for a few seconds.
 */

const RISK_KEY = "settings.risk_pct";
const DEFAULT_RISK_PCT = 6; // % of each copier's balance risked per trade
const TTL_MS = 8_000;

let cache: { pct: number; at: number } | null = null;
const now = () => Date.now();

/** Risk per trade as a PERCENT (e.g. 6 = 6% of the copier's allocation value). */
export async function getRiskPct(db: Database): Promise<number> {
  if (cache && now() - cache.at < TTL_MS) return cache.pct;
  try {
    const [row] = await db
      .select({ metadata: auditLog.metadata })
      .from(auditLog)
      .where(eq(auditLog.action, RISK_KEY))
      .orderBy(desc(auditLog.createdAt))
      .limit(1);
    const raw = (row?.metadata as { pct?: unknown } | null)?.pct;
    const pct = typeof raw === "number" && raw > 0 ? raw : DEFAULT_RISK_PCT;
    cache = { pct, at: now() };
    return pct;
  } catch {
    return DEFAULT_RISK_PCT;
  }
}

export async function setRiskPct(
  db: Database,
  pct: number,
  actorId?: string | null,
): Promise<number> {
  const clamped = Math.max(0.5, Math.min(60, pct));
  await db.insert(auditLog).values({
    actorId: actorId ?? null,
    action: RISK_KEY,
    targetType: "settings",
    metadata: { pct: clamped },
  });
  cache = { pct: clamped, at: now() };
  return clamped;
}

export { DEFAULT_RISK_PCT };
