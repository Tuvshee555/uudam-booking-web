/**
 * QPay v2 merchant API client.
 *
 * Credentials point at merchant.qpay.mn — this is the live production API,
 * not a sandbox. Two rules follow from that:
 *
 * 1. Never trust a client or webhook's claim that a payment succeeded.
 *    `checkInvoice` re-asks QPay directly, and it is the only function in
 *    this file allowed to mark a booking paid.
 * 2. Payment confirmation must be idempotent. QPay's webhook can fire more
 *    than once for the same invoice; calling code checks the booking's
 *    current status before writing, so a repeat notification is a no-op.
 */

const BASE_URL = process.env.QPAY_BASE_URL;
const USERNAME = process.env.QPAY_USERNAME;
const PASSWORD = process.env.QPAY_PASSWORD;
const INVOICE_CODE = process.env.QPAY_INVOICE_CODE;

function configured() {
  return Boolean(BASE_URL && USERNAME && PASSWORD && INVOICE_CODE);
}

export function qpayConfigured() {
  return configured();
}

type TokenSet = { accessToken: string; refreshToken: string; expiresAt: number };

// Module-level cache: one merchant account, one token, shared across
// requests in this process. A serverless cold start just re-authenticates.
let cached: TokenSet | null = null;

async function fetchToken(): Promise<TokenSet> {
  const basic = Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64");

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });

  if (!res.ok) {
    throw new Error(`QPay auth failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    // Refresh a minute early rather than racing the exact expiry moment.
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
}

async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.accessToken;
  cached = await fetchToken();
  return cached.accessToken;
}

async function authed(path: string, init: RequestInit = {}, retrying = false): Promise<Response> {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  // A cached token can go stale for reasons other than our own clock (the
  // merchant session was revoked, QPay's own expiry differs slightly) — one
  // retry with a forced re-auth covers that without a retry loop.
  if (res.status === 401 && !retrying) {
    cached = null;
    return authed(path, init, true);
  }

  return res;
}

export type QpayInvoice = {
  invoiceId: string;
  qrText: string;
  qrImage: string;
  deepLinks: { name: string; link: string }[];
};

/**
 * Create an invoice for one payment against one booking. `senderInvoiceNo`
 * is the booking reference — QPay's own record of who this money is for,
 * independent of anything our side reports back.
 */
export async function createInvoice(params: {
  amount: number;
  senderInvoiceNo: string;
  description: string;
  callbackUrl: string;
}): Promise<QpayInvoice> {
  if (!configured()) throw new Error("QPay is not configured");

  const res = await authed("/invoice", {
    method: "POST",
    body: JSON.stringify({
      invoice_code: INVOICE_CODE,
      sender_invoice_no: params.senderInvoiceNo,
      invoice_receiver_code: "terminal",
      invoice_description: params.description,
      amount: params.amount,
      callback_url: params.callbackUrl,
    }),
  });

  if (!res.ok) {
    throw new Error(`QPay invoice creation failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as {
    invoice_id: string;
    qr_text: string;
    qr_image: string;
    urls?: { name: string; link: string }[];
  };

  return {
    invoiceId: body.invoice_id,
    qrText: body.qr_text,
    qrImage: body.qr_image,
    deepLinks: body.urls ?? [],
  };
}

export type QpayPaymentCheck = {
  paid: boolean;
  paidAmount: number;
  paymentId: string | null;
};

/**
 * The only source of truth for "did this invoice actually get paid" —
 * called from the webhook, from the customer's status poll, and nowhere
 * else. Both of those callers pass through here rather than trusting their
 * own inputs, which is what makes a duplicate or forged webhook harmless.
 */
export async function checkInvoice(invoiceId: string): Promise<QpayPaymentCheck> {
  const res = await authed("/payment/check", {
    method: "POST",
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  if (!res.ok) {
    throw new Error(`QPay payment check failed: ${res.status} ${await res.text()}`);
  }

  const body = (await res.json()) as {
    count: number;
    rows: { payment_id: string; payment_status: string; payment_amount: string }[];
  };

  const paidRow = body.rows.find((row) => row.payment_status === "PAID");

  return {
    paid: Boolean(paidRow),
    paidAmount: paidRow ? Number(paidRow.payment_amount) : 0,
    paymentId: paidRow?.payment_id ?? null,
  };
}

/** Best-effort cancel — used for cleanup, never load-bearing. */
export async function cancelInvoice(invoiceId: string): Promise<void> {
  await authed(`/invoice/${invoiceId}`, { method: "DELETE" }).catch(() => {});
}
