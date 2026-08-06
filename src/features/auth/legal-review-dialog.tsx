type LegalDocument = "terms" | "privacy";

const legalCopy = {
  terms: {
    title: "Termos de Uso",
    sections: [
      ["O que o North faz", "O North organiza informações fornecidas por você e oferece conteúdo educacional sobre investimentos. Ele não executa ordens, não acessa sua conta bancária e não substitui aconselhamento profissional."],
      ["Suas informações", "Você é responsável pela exatidão dos dados cadastrados. Dados de carteira, metas e perfil são usados somente para oferecer as funcionalidades descritas no aplicativo."],
      ["Riscos", "Investimentos envolvem riscos e podem gerar perdas. Simulações e conteúdos não garantem rentabilidade futura."],
    ],
  },
  privacy: {
    title: "Política de Privacidade",
    sections: [
      ["Dados tratados", "Tratamos dados de conta, perfil de investidor, instituições informadas, carteira e metas cadastradas para operar o North."],
      ["Como usamos", "Usamos os dados para autenticação, segurança e funcionalidades solicitadas. Não vendemos seus dados e não usamos valores financeiros em publicidade."],
      ["Seus direitos", "Você poderá solicitar acesso, correção, exportação e exclusão dos seus dados, respeitadas as obrigações legais aplicáveis."],
    ],
  },
} satisfies Record<LegalDocument, {
  title: string;
  sections: Array<[string, string]>;
}>;

export function LegalReviewDialog({
  document,
  onClose,
}: {
  document: LegalDocument;
  onClose: () => void;
}) {
  const content = legalCopy[document];

  return <div className="legal-dialog-backdrop" role="presentation">
    <section
      className="legal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-dialog-title"
    >
      <header>
        <div><p className="eyebrow">Leia antes de continuar</p><h2 id="legal-dialog-title">{content.title}</h2></div>
        <button type="button" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      <div className="legal-dialog-copy">
        {content.sections.map(([title, paragraph]) => <section key={title}>
          <h3>{title}</h3>
          <p>{paragraph}</p>
        </section>)}
      </div>
      <button className="button" type="button" onClick={onClose} autoFocus>
        Voltar ao cadastro
      </button>
    </section>
  </div>;
}

export type { LegalDocument };
