import "server-only";
import { renderWelcome } from "./templates.ts";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const WELCOME_FROM = "north. <no_reply@auth.usenorthapp.com.br>";

type Fetcher = typeof fetch;

export type WelcomeEmailStatus = "sent" | "skipped" | "failed";

function northHomeUrl(appUrl: string) {
  const url = new URL(appUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("invalid_app_url");
  }
  return new URL("/inicio", url.origin).toString();
}

export function renderWelcomeEmail(appUrl: string) {
  return renderWelcome(northHomeUrl(appUrl));
}

export async function sendWelcomeEmail({
  apiKey,
  appUrl,
  to,
  userId,
  fetcher = fetch,
}: {
  apiKey?: string;
  appUrl: string;
  to: string;
  userId: string;
  fetcher?: Fetcher;
}): Promise<WelcomeEmailStatus> {
  if (!apiKey) return "skipped";

  const response = await fetcher(RESEND_EMAILS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `north-welcome-${userId}`,
    },
    body: JSON.stringify({
      from: WELCOME_FROM,
      to: [to],
      subject: "Seu north. está pronto",
      html: renderWelcomeEmail(appUrl),
    }),
  });

  return response.ok ? "sent" : "failed";
}
