import "server-only";
import { Resend } from "resend";
import { COMPANY } from "@/lib/company";

/**
 * Transactional email via Resend.
 *
 * Configure with RESEND_API_KEY and EMAIL_FROM. If they are not set, emails are
 * skipped (logged) rather than throwing — so registration never fails just
 * because email isn't wired up yet.
 */

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM ?? `${COMPANY.name} <onboarding@resend.dev>`;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const resend = client();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped "${input.subject}" to ${input.to}`);
    return { ok: true, skipped: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) {
      console.error("[email] send failed:", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send threw:", e);
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/* -------------------------------------------------------------------------- */
/*  Templates                                                                  */
/* -------------------------------------------------------------------------- */

const BRAND = "#00dfa4";

function shell(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#05070c;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e6edf7;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:24px;">
        Prime<span style="color:${BRAND};">Stone</span>
      </div>
      <div style="background:#0b0f17;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#fff;">${title}</h1>
        ${body}
      </div>
      <p style="margin:22px 4px 0;font-size:11.5px;line-height:1.6;color:#64748b;">
        ${COMPANY.name} · ${COMPANY.address.line1}, ${COMPANY.address.city}, ${COMPANY.address.country}<br/>
        Regulated by the ${COMPANY.regulator}. Trading carries risk; you can lose your capital.
      </p>
    </div>
  </body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#05070c;font-weight:600;
    text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;">${label}</a>`;
}

export function welcomeEmail(input: { firstName: string; loginUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `Welcome to ${COMPANY.name}`,
    html: shell(
      `Welcome aboard, ${input.firstName}.`,
      `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#c7d2e0;">
         Your ${COMPANY.name} account is ready. You can now browse verified strategy
         providers, fund your account, and start copying — all from your dashboard.
       </p>
       <p style="margin:0 0 22px;font-size:14.5px;line-height:1.6;color:#c7d2e0;">
         A quick tip: verify your identity early so withdrawals are enabled the moment
         you want them.
       </p>
       ${button(input.loginUrl, "Go to my dashboard")}`,
    ),
  };
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#c7d2e0;">${label}
    <strong style="color:#fff;">${value}</strong></p>`;
}

export function depositCreditedEmail(input: {
  firstName: string;
  amount: string;
  method: string;
  dashboardUrl: string;
}) {
  return {
    subject: `Deposit received — ${input.amount}`,
    html: shell(
      "Your deposit is in 🎉",
      `${row(`Hi ${input.firstName}, we've credited your account with`, input.amount)}
       <p style="margin:0 0 22px;font-size:13.5px;color:#8b97a8;">Method: ${input.method}. It's ready to allocate to a strategy provider.</p>
       ${button(input.dashboardUrl, "View my balance")}`,
    ),
  };
}

export function withdrawalPaidEmail(input: { firstName: string; amount: string; dashboardUrl: string }) {
  return {
    subject: `Withdrawal sent — ${input.amount}`,
    html: shell(
      "Your withdrawal is on its way",
      `${row(`Hi ${input.firstName}, we've sent`, input.amount)}
       <p style="margin:0 0 22px;font-size:13.5px;color:#8b97a8;">It should reflect on your M-Pesa shortly.</p>
       ${button(input.dashboardUrl, "View transactions")}`,
    ),
  };
}

export function withdrawalRejectedEmail(input: {
  firstName: string;
  amount: string;
  reason?: string;
  dashboardUrl: string;
}) {
  return {
    subject: `Withdrawal not processed — ${input.amount} returned`,
    html: shell(
      "Withdrawal returned to your balance",
      `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#c7d2e0;">
         Hi ${input.firstName}, your withdrawal request for <strong style="color:#fff;">${input.amount}</strong>
         couldn't be processed${input.reason ? `: ${input.reason}` : ""}. The funds have been returned
         to your available balance.</p>
       ${button(input.dashboardUrl, "View my balance")}`,
    ),
  };
}

export function kycApprovedEmail(input: { firstName: string; dashboardUrl: string }) {
  return {
    subject: "Your identity is verified ✅",
    html: shell(
      "You're verified",
      `<p style="margin:0 0 22px;font-size:14.5px;line-height:1.6;color:#c7d2e0;">
         Great news ${input.firstName} — your identity has been confirmed. Withdrawals are now
         enabled on your account.</p>
       ${button(input.dashboardUrl, "Go to my account")}`,
    ),
  };
}

export function kycRejectedEmail(input: { firstName: string; reason?: string; verifyUrl: string }) {
  return {
    subject: "Identity verification needs another look",
    html: shell(
      "We couldn't verify your documents",
      `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#c7d2e0;">
         Hi ${input.firstName}, we weren't able to verify your identity${input.reason ? `: ${input.reason}` : ""}.
         Please re-submit clear, valid documents and we'll review again.</p>
       ${button(input.verifyUrl, "Re-submit documents")}`,
    ),
  };
}

export function passwordResetEmail(input: { firstName: string; resetUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: `Reset your ${COMPANY.name} password`,
    html: shell(
      "Reset your password",
      `<p style="margin:0 0 16px;font-size:14.5px;line-height:1.6;color:#c7d2e0;">
         Hi ${input.firstName}, we received a request to reset your password. Click below
         to choose a new one. This link expires in 60 minutes.
       </p>
       <p style="margin:0 0 22px;">${button(input.resetUrl, "Reset password")}</p>
       <p style="margin:0;font-size:12.5px;line-height:1.6;color:#8b97a8;">
         If you didn't request this, you can safely ignore this email — your password
         stays the same.
       </p>`,
    ),
  };
}
