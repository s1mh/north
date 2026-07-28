import Link from "next/link";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="legal-shell">
      <Link href="/cadastro">← Voltar</Link>
      <p className="eyebrow">Versão 28 de julho de 2026</p>
      <h1>{title}</h1>
      {children}
      <p className="legal-review">Texto inicial sujeito à revisão jurídica antes do beta público.</p>
    </main>
  );
}
