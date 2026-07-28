import "server-only";

/**
 * Safaricom Daraja (M-Pesa) client — STK Push (Lipa na M-Pesa Online).
 *
 * Credentials come from the environment; nothing is hard-coded. Set
 * MPESA_ENVIRONMENT to "sandbox" while testing and "production" once Safaricom
 * grants go-live. Amounts are whole KES (M-Pesa does not do cents).
 */

type MpesaEnv = "sandbox" | "production";

function config() {
  const env = (process.env.MPESA_ENVIRONMENT as MpesaEnv) ?? "sandbox";
  const base =
    env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const consumerKey = process.env.MPESA_CONSUMER_KEY ?? "";
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET ?? "";
  const shortcode = process.env.MPESA_SHORTCODE ?? "174379";
  const passkey = process.env.MPESA_PASSKEY ?? "";
  const callbackUrl = process.env.MPESA_CALLBACK_URL ?? "";
  return { env, base, consumerKey, consumerSecret, shortcode, passkey, callbackUrl };
}

export function isMpesaConfigured(): boolean {
  const c = config();
  return Boolean(c.consumerKey && c.consumerSecret && c.passkey);
}

/** yyyyMMddHHmmss in EAT (UTC+3) — used for both the password and the request. */
function timestamp(now = new Date()): string {
  const eat = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${eat.getUTCFullYear()}${p(eat.getUTCMonth() + 1)}${p(eat.getUTCDate())}` +
    `${p(eat.getUTCHours())}${p(eat.getUTCMinutes())}${p(eat.getUTCSeconds())}`
  );
}

/** Normalise a Kenyan number to the 2547XXXXXXXX format Daraja requires. */
export function normalizeMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

async function getAccessToken(): Promise<string> {
  const c = config();
  const auth = Buffer.from(`${c.consumerKey}:${c.consumerSecret}`).toString("base64");
  const res = await fetch(`${c.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("M-Pesa auth returned no token");
  return data.access_token;
}

export type StkPushResult =
  | { ok: true; checkoutRequestId: string; merchantRequestId: string; customerMessage: string }
  | { ok: false; error: string };

/**
 * Trigger an STK Push so the customer gets a PIN prompt on their phone.
 * The actual crediting happens later, in the callback — never here.
 */
export async function stkPush(input: {
  phone: string;
  amount: number; // whole KES
  accountReference: string;
  description?: string;
}): Promise<StkPushResult> {
  const c = config();
  if (!isMpesaConfigured()) return { ok: false, error: "M-Pesa is not configured." };
  if (!c.callbackUrl) return { ok: false, error: "MPESA_CALLBACK_URL is not set." };

  const ts = timestamp();
  const password = Buffer.from(`${c.shortcode}${c.passkey}${ts}`).toString("base64");
  const msisdn = normalizeMsisdn(input.phone);

  try {
    const token = await getAccessToken();
    const res = await fetch(`${c.base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        BusinessShortCode: c.shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.max(1, Math.round(input.amount)),
        PartyA: msisdn,
        PartyB: c.shortcode,
        PhoneNumber: msisdn,
        CallBackURL: c.callbackUrl,
        AccountReference: input.accountReference.slice(0, 12),
        TransactionDesc: (input.description ?? "Deposit").slice(0, 20),
      }),
    });

    const data = (await res.json()) as Record<string, string>;
    if (data.ResponseCode === "0") {
      return {
        ok: true,
        checkoutRequestId: data.CheckoutRequestID!,
        merchantRequestId: data.MerchantRequestID!,
        customerMessage: data.CustomerMessage ?? "Check your phone to authorise the payment.",
      };
    }
    return { ok: false, error: data.errorMessage ?? data.ResponseDescription ?? "STK push failed." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "M-Pesa request failed." };
  }
}

/** Parse the fields we need out of Safaricom's STK callback body. */
export function parseStkCallback(body: unknown): {
  checkoutRequestId: string | null;
  success: boolean;
  receipt: string | null;
  amount: number | null;
  phone: string | null;
} {
  const stk = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
  if (!stk) return { checkoutRequestId: null, success: false, receipt: null, amount: null, phone: null };

  const checkoutRequestId = (stk.CheckoutRequestID as string) ?? null;
  const success = stk.ResultCode === 0 || stk.ResultCode === "0";

  const items =
    (stk.CallbackMetadata as { Item?: { Name: string; Value: unknown }[] } | undefined)?.Item ?? [];
  const find = (name: string) => items.find((i) => i.Name === name)?.Value;

  return {
    checkoutRequestId,
    success,
    receipt: (find("MpesaReceiptNumber") as string) ?? null,
    amount: (find("Amount") as number) ?? null,
    phone: find("PhoneNumber") ? String(find("PhoneNumber")) : null,
  };
}
