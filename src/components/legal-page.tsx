import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="legal-shell">
      <Link href="/cadastro">← Voltar</Link>
      <p className="eyebrow">Versão de 16 de novembro de 2026</p>
      <h1>{title}</h1>
      {children}
      <p className="legal-review">Este texto foi escrito para o teste fechado do north. e ainda não passou por revisão jurídica. Ele pode mudar, e avisaremos quando mudar.</p>
      <SiteFooter compact />
    </main>
  );
}
