import "server-only";
import { sendEmail, type SendStatus } from "@/server/email/send";
import { renderOpsAlert } from "@/server/email/templates";

/** Avisa quem opera o produto quando uma coleta de mercado falha. Nunca derruba a coleta. */
export async function notifyIngestionFailure({
  apiKey,
  to,
  siteUrl,
  sourceId,
  errorCode,
  jobKey,
  fetcher,
}: {
  apiKey?: string;
  to?: string;
  siteUrl: string;
  sourceId: string;
  errorCode: string;
  jobKey: string;
  fetcher?: typeof fetch;
}): Promise<SendStatus> {
  if (!to) return "skipped";
  return sendEmail({
    apiKey,
    to,
    subject: `north.: a coleta de ${sourceId} falhou`,
    html: renderOpsAlert({ source: sourceId, reason: errorCode, since: jobKey.replace(/^daily-/, ""), adminUrl: siteUrl }),
    idempotencyKey: `north-ops-${sourceId}-${jobKey}`,
    fetcher,
  });
}
