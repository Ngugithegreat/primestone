/**
 * End-to-end backend verification against embedded Postgres (PGlite).
 *
 * PGlite is real Postgres compiled to WASM, so this exercises the actual SQL,
 * constraints and transactions the production database will run — no server,
 * no network, no mocks. Run it with:  npm run verify:backend
 *
 * It walks the full money path: register → login/session → deposit (ledger) →
 * KYC submit + admin review → allocate to a provider → withdraw (KYC-gated) →
 * and asserts the ledger stays balanced throughout.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db/client";
import {
  createSession,
  login,
  register,
  resolveSession,
} from "../src/server/auth";
import {
  balanceOf,
  clientCashBalance,
  ensureClientCashAccount,
  ensureSystemAccount,
  post,
  toMajor,
  toMinor,
} from "../src/server/ledger";
import { confirmDeposit, initiateDeposit, requestWithdrawal } from "../src/server/payments";
import { submitKyc, reviewKyc } from "../src/server/kyc";
import { createProvider } from "../src/server/providers";
import { allocate, deallocate, listAllocations } from "../src/server/allocations";
import { ledgerEntries } from "../src/db/schema";

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label} ${detail}`);
  }
}

/** Assert the entire ledger nets to zero — the core money invariant. */
async function assertLedgerBalanced(db: Database, label: string) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${ledgerEntries.amount}),0)::bigint` })
    .from(ledgerEntries);
  check(`ledger nets to zero — ${label}`, Number(row?.total ?? 0) === 0, `(got ${row?.total})`);
}

async function main() {
  console.log("\nPrimeStone backend verification (embedded Postgres)\n");

  const pg = new PGlite();
  const db = drizzle(pg, { schema }) as unknown as Database;

  // Apply every generated migration in order.
  const migrationsDir = join(process.cwd(), "drizzle");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sqlText = readFileSync(join(migrationsDir, file), "utf8");
    for (const stmt of sqlText.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await pg.exec(trimmed);
    }
  }
  console.log(`Schema applied (${files.length} migration${files.length === 1 ? "" : "s"}).\n`);

  /* --- Auth ------------------------------------------------------------- */
  console.log("Auth");
  const reg = await register(db, {
    email: "Client@Example.com",
    password: "correct horse battery",
    firstName: "Amina",
    lastName: "Okafor",
    phone: "+254700000001",
    country: "Kenya",
    accountType: "standard",
  });
  check("register succeeds", reg.ok);
  const userId = reg.ok ? reg.user.id : "";
  check("email normalised to lowercase", reg.ok && reg.user.email === "client@example.com");

  const dupe = await register(db, {
    email: "client@example.com",
    password: "another one two",
    firstName: "Imposter",
  });
  check("duplicate email rejected", !dupe.ok);

  const badLogin = await login(db, "client@example.com", "wrong password");
  check("wrong password rejected", !badLogin.ok);
  const goodLogin = await login(db, "client@example.com", "correct horse battery");
  check("correct password accepted", goodLogin.ok);

  const { token } = await createSession(db, userId);
  const resolved = await resolveSession(db, token);
  check("session resolves to the user", resolved?.id === userId);
  check("bad session token resolves to null", (await resolveSession(db, "deadbeef")) === null);

  /* --- Deposit (ledger) ------------------------------------------------- */
  console.log("\nDeposits");
  await ensureSystemAccount(db, "system_deposits_clearing");
  const payId = await initiateDeposit(db, { userId, provider: "mpesa", amount: 500 });
  const conf = await confirmDeposit(db, { paymentId: payId, externalRef: "MPESA-RCT-001" });
  check("deposit confirmed", conf.ok && !conf.alreadyProcessed);

  let cash = await clientCashBalance(db, userId);
  check("cash credited $500.00", cash === toMinor(500), `(got ${toMajor(cash)})`);

  // Idempotency: replaying the same callback must not double-credit.
  const replay = await confirmDeposit(db, { paymentId: payId, externalRef: "MPESA-RCT-001" });
  check("duplicate callback is idempotent", replay.alreadyProcessed);
  cash = await clientCashBalance(db, userId);
  check("cash still $500.00 after replay", cash === toMinor(500), `(got ${toMajor(cash)})`);
  await assertLedgerBalanced(db, "after deposit");

  /* --- Withdrawal gated on KYC ------------------------------------------ */
  console.log("\nKYC gate on withdrawal");
  const blocked = await requestWithdrawal(db, {
    userId,
    provider: "mpesa",
    amount: 100,
    destination: "+254700000001",
  });
  check("withdrawal blocked before KYC", !blocked.ok);

  /* --- KYC submit + admin review ---------------------------------------- */
  console.log("\nKYC");
  const docs = (["id_front", "id_back", "selfie", "proof_of_address"] as const).map((type) => ({
    type,
    storageKey: `blob://kyc/${userId}/${type}`,
    fileName: `${type}.jpg`,
    fileSize: 1024,
    contentType: "image/jpeg",
  }));
  const submitted = await submitKyc(db, {
    userId,
    idType: "National ID",
    idNumber: "12345678",
    dateOfBirth: "1994-06-12",
    residentialAddress: "12 Kenyatta Ave, Nairobi",
    documents: docs,
  });
  check("KYC submitted", submitted.ok);

  const [afterSubmit] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  check("user KYC cache = pending", afterSubmit?.kycStatusCache === "pending");
  const [profile] = await db
    .select()
    .from(schema.kycProfiles)
    .where(eq(schema.kycProfiles.userId, userId));
  check("id number stored masked, not raw", profile?.idNumberMasked === "••••5678");
  check("raw id number never stored", !JSON.stringify(profile).includes("12345678"));

  // A client cannot approve KYC.
  const notAdmin = await reviewKyc(db, {
    reviewerId: userId,
    userId,
    decision: "verified",
  });
  check("client cannot approve KYC", !notAdmin.ok);

  // Make an owner and approve.
  const ownerReg = await register(db, {
    email: "owner@primestone.com",
    password: "owner secret pass",
    firstName: "Owner",
  });
  const ownerId = ownerReg.ok ? ownerReg.user.id : "";
  await db.update(schema.users).set({ role: "owner" }).where(eq(schema.users.id, ownerId));
  const approved = await reviewKyc(db, { reviewerId: ownerId, userId, decision: "verified" });
  check("owner approves KYC", approved.ok);
  const [afterApprove] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  check("user KYC cache = verified", afterApprove?.kycStatusCache === "verified");

  /* --- Providers + allocation ------------------------------------------- */
  console.log("\nProviders & allocations");
  const prov = await createProvider(db, {
    name: "Kwame Mwangi",
    strategy: "Swing / Trend",
    feeBps: 2000,
    minInvestment: 100,
    verified: true,
  });
  check("provider created", prov.ok);
  const providerId = prov.ok ? prov.id : "";

  const tooSmall = await allocate(db, { userId, providerId, amount: 50 });
  check("allocation below minimum rejected", !tooSmall.ok);

  const alloc = await allocate(db, { userId, providerId, amount: 300 });
  check("allocate $300 succeeds", alloc.ok);
  cash = await clientCashBalance(db, userId);
  check("cash reduced to $200.00 after allocation", cash === toMinor(200), `(got ${toMajor(cash)})`);

  const overAllocate = await allocate(db, { userId, providerId, amount: 9999 });
  check("over-allocation rejected", !overAllocate.ok);

  const list = await listAllocations(db, userId);
  check("allocation appears in list", list.length === 1 && list[0]!.allocation.amount === toMinor(300));
  await assertLedgerBalanced(db, "after allocation");

  /* --- Withdrawal after verification ------------------------------------ */
  console.log("\nWithdrawal after verification");
  const wd = await requestWithdrawal(db, {
    userId,
    provider: "mpesa",
    amount: 150,
    fee: 0,
    destination: "+254700000001",
  });
  check("withdrawal now allowed", wd.ok);
  cash = await clientCashBalance(db, userId);
  check("cash reduced to $50.00 after withdrawal", cash === toMinor(50), `(got ${toMajor(cash)})`);

  const overdraw = await requestWithdrawal(db, {
    userId,
    provider: "mpesa",
    amount: 9999,
    destination: "+254700000001",
  });
  check("overdraw rejected", !overdraw.ok);
  await assertLedgerBalanced(db, "after withdrawal");

  /* --- Deallocate ------------------------------------------------------- */
  console.log("\nDeallocation");
  const allocId = alloc.ok ? alloc.allocationId : "";
  const back = await deallocate(db, { userId, allocationId: allocId });
  check("deallocate returns committed funds", back.ok && back.ok === true);
  cash = await clientCashBalance(db, userId);
  check("cash back to $350.00 after deallocation", cash === toMinor(350), `(got ${toMajor(cash)})`);
  await assertLedgerBalanced(db, "after deallocation");

  /* --- Summary ---------------------------------------------------------- */
  console.log(`\n${pass} passed, ${fail} failed\n`);
  await pg.close();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
