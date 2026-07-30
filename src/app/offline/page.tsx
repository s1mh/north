import Link from "next/link";

export default function OfflinePage() {
  return <main className="offline-shell">
    <span className="offline-mark" aria-hidden="true">N</span>
    <p className="eyebrow">Sem conexão</p>
    <h1>Seus dados não ficam guardados nesta tela.</h1>
    <p>Quando a internet voltar, entre novamente para consultar informações atuais e protegidas.</p>
    <Link className="button" href="/">Tentar novamente</Link>
  </main>;
}
