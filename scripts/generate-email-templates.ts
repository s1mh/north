// Gera os modelos de e-mail a partir do layout único.
// Uso: node scripts/generate-email-templates.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { authTemplates, renderAccountDeleted, renderOpsAlert, renderWelcome } from "../src/server/email/templates.ts";

mkdirSync("supabase/templates", { recursive: true });
mkdirSync("docs/email-previews", { recursive: true });

for (const [name, template] of Object.entries(authTemplates)) {
  writeFileSync(`supabase/templates/${name}.html`, template.html);
  writeFileSync(`docs/email-previews/${name}.html`, template.html
    .replaceAll("{{ .ConfirmationURL }}", "#").replaceAll("{{ .NewEmail }}", "novo@exemplo.com").replaceAll("{{ .Token }}", "48271930").replaceAll("{{ .OldEmail }}", "antigo@exemplo.com").replaceAll("{{ .OldPhone }}", "+55 11 90000-0000").replaceAll("{{ .Provider }}", "google").replaceAll("{{ .FactorType }}", "totp"));
}
writeFileSync("docs/email-previews/welcome.html", renderWelcome("https://usenorthapp.com.br/inicio"));
writeFileSync("docs/email-previews/account-deleted.html", renderAccountDeleted());
writeFileSync("docs/email-previews/ops-alert.html", renderOpsAlert({ source: "bcb-sgs", reason: "bcb_future_date", since: "04/11/2026", adminUrl: "https://usenorthapp.com.br" }));
console.log("ok");
