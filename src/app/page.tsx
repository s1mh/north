import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="welcome-shell">
      <div className="welcome-mark" aria-hidden="true">
        <span>n</span>
      </div>
      <section className="welcome-copy">
        <p className="welcome-wordmark">north.</p>
        <h1>Seu dinheiro,<br />numa direção só.</h1>
        <p>Carteira, metas e mercado explicados de um jeito que faz sentido pra você.</p>
      </section>
      <div className="welcome-actions">
        <Link className="welcome-primary" href="/cadastro">Criar minha conta</Link>
        <Link className="welcome-secondary" href="/entrar">Entrar</Link>
        <small>Educacional · não é recomendação de investimento</small>
      </div>
    </main>
  );
}
