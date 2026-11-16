"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { canUndo, type ActionKind, type ActionStatus, type ActionView } from "@/features/assistant/actions";
import type { AssistantInsight } from "@/features/assistant/types";

export type ChatAction = { id: string; kind: ActionKind; status: ActionStatus; view: ActionView | null };
export type ChatMessage = { id: string; role: "user" | "assistant"; text: string; actions: ChatAction[] };
export type ThreadItem = { id: string; title: string; updated_at: string };

/** Atalhos que mudam conforme a situação da pessoa. */
export function suggestionsFor({ hasAssets, hasGoals, messages }: {
  hasAssets: boolean;
  hasGoals: boolean;
  messages: ChatMessage[];
}): string[] {
  if (messages.length > 0) {
    const last = [...messages].reverse().find((item) => item.role === "assistant");
    const confirmed = last?.actions.some((action) => action.status === "confirmed");
    return confirmed ? ["Registrar outro", "Como está minha carteira?"] : [];
  }
  const list: string[] = [];
  if (hasAssets) list.push("Registrar um aporte", "Como está minha carteira?");
  else list.push("Cadastrar meu primeiro ativo");
  list.push(hasGoals ? "Estou no ritmo da minha meta?" : "Criar uma meta");
  if (hasAssets) list.push("Corrigir um lançamento");
  return list;
}

const DISCLAIMER = "Conteúdo educacional. O north. não recomenda investimentos, não executa ordens e não move dinheiro: só registra o seu controle manual.";

/** Mostra **negrito** como negrito, sem outros recursos de markdown. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith("**") && part.endsWith("**") && part.length > 4
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : part);
}

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
      {canUndo(action.kind) ? <button type="button" className="asst-cancel" disabled={busy} onClick={() => decide("undo")}>
        {busy ? "Desfazendo…" : "Desfazer"}
      </button> : null}
      <Link href={action.kind === "create_goal" ? "/metas" : "/carteira"} className="asst-link">
        {action.kind === "create_goal" ? "Ver metas →" : "Ver carteira →"}
      </Link>
    </div> : null}
  </article>;
}

const greetings = ["Eaí", "Fala", "Opa", "Olá"] as const;

const registerIntent = /\b(coloquei|coloquei|guardei|apliquei|investi|comprei|vendi|resgatei|saquei|tirei|recebi|paguei|depositei|aportei|registr\w*|anot\w*|lanç\w*|adicion\w*)\b/i;

/** Mensagem instantânea do app (não vai para o provedor de IA e não fica salva). */
function acknowledgement(question: string, firstName: string) {
  const who = firstName ? `, ${firstName}` : "";
  const options = registerIntent.test(question)
    ? [`Certo${who}! Vou preparar esse registro`, `Beleza${who}, deixa comigo`, `Pode deixar${who}, já organizo isso`]
    : [`Boa${who}! Deixa eu olhar aqui`, `Já te respondo${who}`, `Certo${who}, vou ver isso`];
  return options[Math.floor(Math.random() * options.length)] ?? options[0]!;
}

export function AssistantChat({
  hasAssets,
  hasGoals,
  firstName,
  threads: initialThreads,
  initialThreadId,
  initialMessages,
  insights,
}: {
  hasAssets: boolean;
  hasGoals: boolean;
  firstName: string;
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
  const [ack, setAck] = useState("");
  const [status, setStatus] = useState("");
  const [streaming, setStreaming] = useState("");
  const [greeting] = useState(() => greetings[Math.floor(Math.random() * greetings.length)] ?? "Eaí");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, pending, streaming, status]);

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

    setAck(acknowledgement(trimmed, firstName));
    setStatus("");
    setStreaming("");

    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message: trimmed }),
    }).catch(() => null);

    const undo = (message: string) => {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setMessage(trimmed);
      setError(message);
      setPending(false);
      setAck("");
      setStatus("");
      setStreaming("");
    };

    if (!response?.ok || !response.body) {
      const result = await response?.json().catch(() => null);
      undo(result?.error ?? "Não foi possível conversar agora.");
      return;
    }

    type Done = {
      threadId: string; userMessage: string; assistantMessageId: string; text: string; actions: ChatAction[];
    };
    let done: Done | null = null;
    let failure = "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let shown = "";
    for (;;) {
      const { value, done: finished } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: { t: string; text?: string; error?: string } & Partial<Done>;
        try { event = JSON.parse(line); } catch { continue; }
        if (event.t === "status") setStatus(event.text ?? "");
        else if (event.t === "reset") { shown = ""; setStreaming(""); }
        else if (event.t === "delta") { shown += event.text ?? ""; setStreaming(shown); setStatus(""); }
        else if (event.t === "error") failure = event.error ?? "Não foi possível responder agora.";
        else if (event.t === "done") done = event as Done;
      }
    }

    if (!done) {
      undo(failure || "Não foi possível responder agora.");
      return;
    }
    const finalReply: Done = done;

    if (!threadId) {
      setThreads((current) => [
        { id: finalReply.threadId, title: trimmed.slice(0, 80), updated_at: new Date().toISOString() },
        ...current,
      ]);
    } else {
      setThreads((current) => current
        .map((thread) => thread.id === threadId ? { ...thread, updated_at: new Date().toISOString() } : thread)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    }
    setThreadId(finalReply.threadId);
    setMessages((current) => [
      ...current.map((item) => item.id === optimisticId ? { ...item, text: finalReply.userMessage } : item),
      { id: finalReply.assistantMessageId, role: "assistant", text: finalReply.text, actions: finalReply.actions ?? [] },
    ]);
    setAck("");
    setStatus("");
    setStreaming("");
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
      <h1>{greeting}{firstName ? `, ${firstName}` : ""}! Como vai hoje?</h1>
      <p className="asst-lead">Pode me perguntar sobre a sua carteira e metas, ou me contar o que você fez, tipo “coloquei 500 reais nas caixinhas do Nu”. Eu preparo o registro e você confirma.</p>
      <div className="assistant-quick-questions">
        {suggestionsFor({ hasAssets, hasGoals, messages }).map((question) => <button type="button" key={question} disabled={pending} onClick={() => ask(question)}>
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
          <p className="asst-bubble">{renderInline(item.text)}</p>
          {item.actions.map((action) => <ActionCard key={action.id} action={action} onChange={setActionStatus} />)}
        </div>)}
      {pending ? <div className="asst-assistant" aria-live="polite">
        {ack ? <p className="asst-bubble">{ack}</p> : null}
        {streaming ? <p className="asst-bubble">{renderInline(streaming)}</p> : <p className="asst-typing" aria-label="North está digitando">
          <span /><span /><span />{status ? <em>{status}</em> : null}
        </p>}
      </div> : null}
      <div ref={bottom} />
    </section>}

    {messages.length > 0 && !pending ? <div className="assistant-quick-questions asst-followups">
      {suggestionsFor({ hasAssets, hasGoals, messages }).map((question) => <button type="button" key={question} onClick={() => ask(question)}>
        {question}
      </button>)}
    </div> : null}

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
              : <button type="button" className="asst-del" aria-label={`Apagar conversa ${thread.title}`} onClick={() => setDeleting(thread.id)}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16" /><path d="M9.5 7V4.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8V7" /><path d="M6.5 7l.7 11.4c.1 1 .9 1.6 1.8 1.6h6c.9 0 1.7-.7 1.8-1.6L17.5 7" /><path d="M10 11v5.5M14 11v5.5" /></svg>
              </button>}
          </li>)}
        </ul>}
        <p className="assistant-retention">As conversas ficam por até 30 dias e podem ser apagadas a qualquer momento.</p>
      </aside>
    </div> : null}
  </div>;
}
