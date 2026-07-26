"use client";

import { motion } from "framer-motion";
import {
  Ban,
  Check,
  Flag,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import {
  DOC_LABELS,
  STATUS_META,
  type AdminUser,
  type KycDocument,
} from "@/lib/kyc";
import { useAdminStore } from "@/lib/adminStore";
import { useStore } from "@/lib/store";
import { dateTimeShort, money } from "@/lib/format";
import { cn, initialsOf } from "@/lib/utils";

const REJECT_REASONS = [
  "ID photo blurred — details not legible.",
  "Selfie does not match the ID document.",
  "Proof of address older than 3 months.",
  "Document appears to be expired.",
  "Details do not match the account.",
];

export function AdminUserDetail({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const approveDemo = useAdminStore((s) => s.approve);
  const rejectDemo = useAdminStore((s) => s.reject);
  const toggleFlag = useAdminStore((s) => s.toggleFlag);
  const reviewSession = useStore((s) => s.reviewKyc);
  const pushToast = useStore((s) => s.pushToast);

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);

  const meta = STATUS_META[user.kyc.status];
  const canReview = user.kyc.status === "pending";

  const approve = () => {
    if (user.isCurrentSession) reviewSession("verified");
    else approveDemo(user.id);
    pushToast({ tone: "success", title: "Identity approved", body: `${user.firstName} can now withdraw.` });
    onClose();
  };

  const reject = () => {
    if (user.isCurrentSession) reviewSession("rejected", reason);
    else rejectDemo(user.id, reason);
    pushToast({ tone: "info", title: "Submission rejected", body: `${user.firstName} has been asked to re-submit.` });
    onClose();
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-white/[0.09] bg-ink-900"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] p-5">
          <div className="flex items-center gap-3">
            <span
              className="grid h-12 w-12 place-items-center rounded-full text-[15px] font-semibold text-ink-950"
              style={{ background: "linear-gradient(140deg,#2ff0bd,#6366f1)" }}
            >
              {initialsOf(`${user.firstName} ${user.lastName}`)}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold text-white">
                  {user.firstName} {user.lastName}
                </h2>
                {user.isCurrentSession && <Badge tone="mint">You</Badge>}
              </div>
              <p className="text-[12.5px] text-slate-500">
                {user.flag} {user.country} · {user.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="focus-ring grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.07] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Status banner */}
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border p-3.5",
              user.kyc.status === "verified"
                ? "border-mint-500/25 bg-mint-500/[0.06]"
                : user.kyc.status === "pending"
                  ? "border-amber-450/25 bg-amber-450/[0.06]"
                  : user.kyc.status === "rejected"
                    ? "border-rose-500/25 bg-rose-500/[0.06]"
                    : "border-white/[0.08] bg-white/[0.02]",
            )}
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-slate-500">KYC status</p>
              <div className="mt-1">
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
            </div>
            <div className="text-right text-[11.5px] text-slate-500">
              {user.kyc.submittedAt && <p>Submitted {dateTimeShort(user.kyc.submittedAt)}</p>}
              {user.kyc.reviewedAt && <p>Reviewed {dateTimeShort(user.kyc.reviewedAt)}</p>}
            </div>
          </div>

          {user.kyc.rejectionReason && (
            <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-3 text-[12.5px] text-rose-300">
              Rejection reason: {user.kyc.rejectionReason}
            </p>
          )}

          {/* Contact + account */}
          <Section title="Contact">
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow icon={Phone} label="Phone" value={user.phone} />
            <InfoRow icon={MapPin} label="Country" value={`${user.flag} ${user.country}`} />
          </Section>

          <Section title="Identity details">
            <InfoRow label="Document type" value={user.kyc.idType} />
            <InfoRow label="Document number" value={user.kyc.idNumberMasked || "—"} mono />
            <InfoRow label="Date of birth" value={user.kyc.dateOfBirth || "—"} />
            <InfoRow label="Residential address" value={user.kyc.residentialAddress || "—"} />
          </Section>

          <Section title="Account">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Balance" value={money(user.balance)} />
              <Metric label="Equity" value={money(user.equity)} />
              <Metric label="Deposited" value={money(user.deposits)} />
              <Metric label="Withdrawn" value={money(user.withdrawals)} />
              <Metric label="Open trades" value={String(user.openTrades)} />
              <Metric label="Copying" value={`${user.copying} providers`} />
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500">
              Joined {dateTimeShort(user.joinedAt)}
            </p>
          </Section>

          {/* Documents */}
          <Section title={`Documents (${user.kyc.documents.length})`}>
            {user.kyc.documents.length === 0 ? (
              <p className="text-[13px] text-slate-500">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {user.kyc.documents.map((doc) => (
                  <DocumentCard key={doc.type} doc={doc} />
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Actions */}
        <div className="border-t border-white/[0.07] p-4">
          {rejecting ? (
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-white">Reason for rejection</p>
              <div className="space-y-1.5">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      "focus-ring flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] transition-colors",
                      reason === r
                        ? "border-rose-500/40 bg-rose-500/[0.08] text-white"
                        : "border-white/[0.07] text-slate-400 hover:bg-white/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-full border",
                        reason === r ? "border-rose-500 bg-rose-500" : "border-white/20",
                      )}
                    >
                      {reason === r && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setRejecting(false)} className="flex-1">
                  Cancel
                </Button>
                <Button variant="danger" onClick={reject} className="flex-1">
                  <XCircle className="h-4 w-4" />
                  Confirm rejection
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFlag(user.id)}
                disabled={user.isCurrentSession}
                className={cn(
                  "focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition-colors disabled:opacity-40",
                  user.flagged
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-400"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]",
                )}
                title={user.flagged ? "Remove flag" : "Flag account"}
              >
                <Flag className="h-4 w-4" />
              </button>

              {canReview ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setRejecting(true)}
                    className="flex-1"
                  >
                    <Ban className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button onClick={approve} className="flex-1">
                    <ShieldCheck className="h-4 w-4" />
                    Approve
                  </Button>
                </>
              ) : (
                <div className="flex-1 text-center text-[12.5px] text-slate-500">
                  {user.kyc.status === "verified"
                    ? "This account is verified."
                    : user.kyc.status === "rejected"
                      ? "Awaiting re-submission from the user."
                      : "User has not submitted documents yet."}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                     */
/* -------------------------------------------------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon?: typeof Mail;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2 last:border-0">
      <span className="flex items-center gap-2 text-[12.5px] text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={cn("text-right text-[13px] text-slate-200", mono && "tnum")}>{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
      <p className="text-[10.5px] text-slate-500">{label}</p>
      <p className="tnum mt-0.5 text-[13.5px] font-semibold text-white">{value}</p>
    </div>
  );
}

/**
 * A document preview. There is no real image — we render a watermarked
 * "specimen" placeholder so the review flow is demonstrable without handling
 * anyone's real ID. In production this shows the securely-fetched document.
 */
function DocumentCard({ doc }: { doc: KycDocument }) {
  const hues = [
    ["#0ea5e9", "#6366f1"],
    ["#00dfa4", "#0ea5e9"],
    ["#f59e0b", "#ef4444"],
    ["#a855f7", "#ec4899"],
  ][doc.specimen ?? 0]!;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <div
        className="relative flex h-24 items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${hues[0]}22, ${hues[1]}22)` }}
      >
        {/* Faux document lines */}
        <div className="absolute inset-0 flex flex-col justify-center gap-1.5 px-4 opacity-40">
          <div className="h-1.5 w-1/2 rounded-full bg-white/30" />
          <div className="h-1.5 w-3/4 rounded-full bg-white/20" />
          <div className="h-1.5 w-2/3 rounded-full bg-white/20" />
        </div>
        <span className="relative rotate-[-8deg] rounded border border-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/70">
          Specimen
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-[12px] font-medium text-white">{DOC_LABELS[doc.type]}</p>
        <p className="truncate text-[10.5px] text-slate-500">
          {doc.fileName} · {Math.round(doc.fileSize / 1024)} KB
        </p>
      </div>
    </div>
  );
}
