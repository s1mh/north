import "server-only";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
export const DEFAULT_FROM = "north. <no_reply@auth.usenorthapp.com.br>";

export type SendStatus = "sent" | "skipped" | "failed";

export async function sendEmail({
  apiKey,
  to,
  subject,
  html,
  idempotencyKey,
  from = DEFAULT_FROM,
  fetcher = fetch,
}: {
  apiKey?: string;
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  from?: string;
  fetcher?: typeof fetch;
}): Promise<SendStatus> {
  if (!apiKey) return "skipped";
  try {
    const response = await fetcher(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
