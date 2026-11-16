import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authTemplates, renderAccountDeleted, renderLoginCode, renderOpsAlert, renderWelcome } from "./templates.ts";
import { CONTACT_EMAIL } from "./layout.ts";

const all = {
  ...Object.fromEntries(Object.entries(authTemplates).map(([k, v]) => [k, v.html])),
  welcome: renderWelcome("https://usenorthapp.com.br/inicio"),
  deleted: renderAccountDeleted(),
  loginCode: renderLoginCode("123456", "login"),
  enableCode: renderLoginCode("123456", "enable"),
  ops: renderOpsAlert({ source: "bcb-sgs", reason: "x", since: "hoje", adminUrl: "https://usenorthapp.com.br" }),
};

describe("e-mails do north", () => {
  it.each(Object.entries(all))("%s traz os avisos obrigatórios no rodapé", (_name, html) => {
    expect(html).toContain("O north é educacional");
    expect(html).toContain("recomendação de investimento");
    expect(html).toContain("maiores de 18 anos");
    expect(html).toContain(CONTACT_EMAIL);
    expect(html).toContain("/privacidade");
    expect(html).toContain("/termos");
  });

  it("e-mails de serviço explicam que não há descadastro", () => {
    for (const [name, html] of Object.entries(all)) {
      if (name === "ops") continue;
      expect(html).toContain("não tem opção de cancelar o envio");
    }
  });

  it("não escapa HTML do alerta interno com dados vindos de fora", () => {
    const html = renderOpsAlert({ source: "<script>x</script>", reason: "a&b", since: "x", adminUrl: "https://usenorthapp.com.br" });
    expect(html).not.toContain("<script>x");
  });

  it("os arquivos do Supabase estão em dia com o gerador (rode npm run emails)", () => {
    for (const [name, template] of Object.entries(authTemplates)) {
      expect(readFileSync(`supabase/templates/${name}.html`, "utf8")).toBe(template.html);
    }
  });
});
