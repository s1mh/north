"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { ActionKind, ActionStatus, ActionView } from "@/features/assistant/actions";
import type { AssistantInsight } from "@/features/assistant/types";

export type ChatAction = { id: string; kind: ActionKind; status: ActionStatus; view: ActionView | null };
export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; actions: ChatAction[] };
export type ThreadItem = { id: string; title: string; updated_at: string };

const suggestions = [
  "Como está minha carteira?",
  "Registrar um aporte",
  "Estou no ritmo da minha meta?",
] as const;

const DISCLAIMER = "Conteúdo educacional. O north. não recomenda investimentos, não executa ordens e não move dinheiro: só registra o seu controle manual.";

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const diff = Math.floor((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

function ActionCard({ action, onChange }: {
  action: ChatAction;
  onChange: (id: string, status: ActionStatus) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "confirm" | "cancel" | "undo") {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/assistant/actions/${action.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { status?: ActionStatus; error?: string } | null;
    setBusy(false);
    if (result?.status) onChange(action.id, result.status);
    if (!response?.ok || result?.error) setError(result?.error ?? "Não foi possível concluir agora.");
  }

  if (!action.view) return null;
  const { status } = action;
  const stateLabel = {
    proposed: "Aguardando sua confirmação",
    confirming: "Registrando…",
    confirmed: "Registrado ✓",
    cancelled: "Cancelado",
    failed: "Não foi registrado",
    undoing: "Desfazendo…",
    undone: "Desfeito",
  }[status];

  return <article className="asst-card" data-status={status}>
    <header><strong>{action.view.title}</strong><span>{stateLabel}</span></header>
    <dl>{action.view.rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {status === "proposed" || status === "failed" ? <div className="asst-card-actions">
      {status === "proposed" ? <>
        <button type="button" className="asst-confirm" disabled={busy} onClick={() => decide("confirm")}>
          {busy ? "Registrando…" : "Confirmar"}
        </button>
        <button type="button" className="asst-cancel" disabled={busy} onClick={() => decide("cancel")}>Cancelar</button>
      </> : null}
    </div> : null}
    {status === "confirmed" ? <div className="asst-card-actions">
      <button type="button" className="asst-cancel" disabled={busy} onClick={() => decide("undo")}>
        {busy ? "Desfazendo…" : "Desfazer"}
      </button>
      <Link href="/carteira" className="asst-link">Ver carteira →</Link>
    </div> : null}
  </article>;
}

export function AssistantChat({
  threads: initialThreads,
  initialThreadId,
  initialMessages,
  insights,
}: {
  threads: ThreadItem[];
  initialThreadId: string | null;
  initialMessages: ChatMessage[];
  insights: AssistantInsight[];
}) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [threadId, setThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  function setActionStatus(actionId: string, status: ActionStatus) {
    setMessages((current) => current.map((item) => ({
      ...item,
      actions: item.actions.map((action) => action.id === actionId ? { ...action, status } : action),
    })));
  }

  async function ask(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [...current, { id: optimisticId, role: "user", text: trimmed, actions: [] }]);

    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message: trimmed }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || !result?.threadId) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setMessage(trimmed);
      setError(result?.error ?? "Não foi possível conversar agora.");
      setPending(false);
      return;
    }

    if (!threadId) {
      setThreads((current) => [
        { id: result.threadId, title: trimmed.slice(0, 80), updated_at: new Date().toISOString() },
        ...current,
      ]);
    } else {
      setThreads((current) => current
        .map((thread) => thread.id === threadId ? { ...thread, updated_at: new Date().toISOString() } : thread)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    }
    setThreadId(result.threadId);
    setMessages((current) => [
      ...current.map((item) => item.id === optimisticId ? { ...item, text: result.userMessage } : item),
      { id: result.assistantMessageId, role: "assistant", text: result.text, actions: result.actions ?? [] },
    ]);
    setPending(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(message);
  }

  async function removeThread(id: string) {
    const response = await fetch(`/api/assistant/threads/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setError("Não foi possível apagar a conversa.");
      setDeleting(null);
      return;
    }
    setThreads((current) => current.filter((thread) => thread.id !== id));
    setDeleting(null);
    if (id === threadId) {
      setMessages([]);
      setThreadId(null);
      router.replace("/assistente?c=nova");
    }
  }

  function openThread(id: string | "nova") {
    setHistoryOpen(false);
    router.push(`/assistente?c=${id}`);
  }

  return <div className="assistant-chat">
    <header className="assistant-header">
      <Link href="/inicio" aria-label="Voltar para o início">←</Link>
      <span className="assistant-orb" aria-hidden="true" />
      <div><strong>North</strong><small>Pergunte ou peça um registro</small></div>
      <div className="asst-header-actions">
        <button type="button" onClick={() => setHistoryOpen(true)} aria-label="Abrir conversas">Conversas</button>
        <button type="button" onClick={() => openThread("nova")} aria-label="Nova conversa" className="asst-new">＋</button>
      </div>
    </header>

    {messages.length === 0 ? <section className="assistant-intro">
      <p className="eyebrow">Seu assistente</p>
      <h1>O que vamos resolver hoje?</h1>
      <p className="asst-lead">Tire dúvidas sobre a sua carteira e metas ou diga o que você fez, por exemplo: “coloquei 500 reais nas caixinhas do Nu”. Eu preparo o registro e você confirma.</p>
      <div className="assistant-quick-questions">
        {suggestions.map((question) => <button type="button" key={question} disabled={pending} onClick={() => ask(question)}>
          {question}
        </button>)}
      </div>
      <p className="eyebrow asst-insights-label">O que merece atenção</p>
      <div className="assistant-insights">
        {insights.map((insight) => <article key={insight.kind} style={{ background: insight.color }}>
          <p>{insight.eyebrow}</p>
          <h2>{insight.title}</h2>
          <span>{insight.body}</span>
          <Link href={insight.href}>{insight.action}</Link>
        </article>)}
      </div>
    </section> : <section className="assistant-messages" aria-live="polite">
      {messages.map((item) => item.role === "user"
        ? <p className="assistant-user-message" key={item.id}>{item.text}</p>
        : <div className="asst-assistant" key={item.id}>
          <p className="asst-bubble">{item.text}</p>
          {item.actions.map((action) => <ActionCard key={action.id} action={action} onChange={setActionStatus} />)}
        </div>)}
      {pending ? <p className="assistant-thinking">North está pensando…</p> : null}
      <div ref={bottom} />
    </section>}

    {error ? <p className="form-error assistant-error" role="alert">{error}</p> : null}

    <div className="asst-composer-wrap">
      <form className="assistant-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="assistant-message">Mensagem para o assistente</label>
        <input
          id="assistant-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Pergunte ou peça um registro…"
          maxLength={500}
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          enterKeyHint="send"
          disabled={pending}
        />
        <button type="submit" aria-label="Enviar mensagem" disabled={pending || message.trim().length < 2}>↑</button>
      </form>
      <p className="asst-disclaimer">{DISCLAIMER}</p>
    </div>

    {historyOpen ? <div className="asst-sheet-backdrop" onClick={() => setHistoryOpen(false)}>
      <aside className="asst-sheet" role="dialog" aria-label="Conversas" onClick={(event) => event.stopPropagation()}>
        <header>
          <strong>Conversas</strong>
          <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Fechar">✕</button>
        </header>
        <button type="button" className="asst-sheet-new" onClick={() => openThread("nova")}>＋ Nova conversa</button>
        {threads.length === 0 ? <p className="asst-empty">Nenhuma conversa ainda.</p> : <ul>
          {threads.map((thread) => <li key={thread.id} data-active={thread.id === threadId}>
            <button type="button" onClick={() => openThread(thread.id)}>
              <strong>{thread.title}</strong><small>{dayLabel(thread.updated_at)}</small>
            </button>
            {deleting === thread.id
              ? <span className="asst-del-confirm">
                <button type="button" onClick={() => removeThread(thread.id)}>Apagar</button>
                <button type="button" onClick={() => setDeleting(null)}>Não</button>
              </span>
              : <button type="button" className="asst-del" aria-label={`Apagar conversa ${thread.title}`} onClick={() => setDeleting(thread.id)}>🗑</button>}
          </li>)}
        </ul>}
        <p className="assistant-retention">As conversas ficam por até 30 dias e podem ser apagadas a qualquer momento.</p>
      </aside>
    </div> : null}
  </div>;
}
