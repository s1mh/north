"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { AssistantInsight, AssistantReply } from "@/features/assistant/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reply: AssistantReply | null;
};

const quickQuestions = [
  "Como está minha carteira?",
  "Estou no ritmo da minha meta?",
  "O que Selic e IPCA significam?",
] as const;

function ReplyCard({ reply }: { reply: AssistantReply }) {
  return <article className="assistant-reply-card">
    <p className="eyebrow">{reply.eyebrow}</p>
    <h2>{reply.title}</h2>
    {reply.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    {reply.facts.length > 0 ? <dl>
      {reply.facts.map((fact) => <div key={`${fact.label}-${fact.value}`}>
        <dt>{fact.label}</dt><dd>{fact.value}</dd>
      </div>)}
    </dl> : null}
    {reply.actions.length > 0 ? <div className="assistant-reply-actions">
      {reply.actions.map((action) => <Link href={action.href} key={action.href}>
        {action.label} →
      </Link>)}
    </div> : null}
    <small>{reply.disclaimer}</small>
  </article>;
}

export function AssistantChat({
  initialThreadId,
  initialMessages,
  insights,
}: {
  initialThreadId: string | null;
  initialMessages: ChatMessage[];
  insights: AssistantInsight[];
}) {
  const [threadId, setThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState(initialMessages);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    const optimisticId = `local-${Date.now()}`;
    setMessages((current) => [...current, {
      id: optimisticId,
      role: "user",
      content: trimmed,
      reply: null,
    }]);

    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message: trimmed }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (!response?.ok || !result?.threadId || !result?.reply) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setMessage(trimmed);
      setError(result?.error ?? "Não foi possível conversar agora.");
      setPending(false);
      return;
    }

    setThreadId(result.threadId);
    setMessages((current) => [
      ...current.map((item) => item.id === optimisticId
        ? { ...item, content: result.userMessage }
        : item),
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: result.reply.paragraphs.join("\n\n"),
        reply: result.reply,
      },
    ]);
    setPending(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await ask(message);
  }

  async function deleteConversation() {
    if (!threadId) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/assistant/threads/${threadId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!response?.ok) {
      const result = await response?.json().catch(() => null);
      setError(result?.error ?? "Não foi possível apagar a conversa.");
      setPending(false);
      setConfirmDelete(false);
      return;
    }
    setMessages([]);
    setThreadId(null);
    setPending(false);
    setConfirmDelete(false);
  }

  return <div className="assistant-chat">
    {messages.length === 0 ? <section className="assistant-intro">
      <p className="eyebrow">Seus insights</p>
      <h1>O que merece atenção agora</h1>
      <div className="assistant-insights">
        {insights.map((insight) => <article
          key={insight.kind}
          style={{ background: insight.color }}
        >
          <p>{insight.eyebrow}</p>
          <h2>{insight.title}</h2>
          <span>{insight.body}</span>
          <Link href={insight.href}>{insight.action}</Link>
        </article>)}
      </div>
      <p className="assistant-retention">
        O histórico fica disponível por até 30 dias e pode ser apagado a qualquer momento.
      </p>
    </section> : <section className="assistant-messages" aria-live="polite">
      {messages.map((item) => item.role === "user"
        ? <p className="assistant-user-message" key={item.id}>{item.content}</p>
        : item.reply ? <ReplyCard reply={item.reply} key={item.id} /> : null)}
      {pending ? <p className="assistant-thinking">North está organizando os fatos conhecidos…</p> : null}
    </section>}

    <div className="assistant-quick-questions">
      {quickQuestions.map((question) => <button
        type="button"
        key={question}
        disabled={pending}
        onClick={() => ask(question)}
      >{question}</button>)}
    </div>

    {threadId ? <div className="assistant-delete">
      {!confirmDelete ? <button type="button" onClick={() => setConfirmDelete(true)}>
        Apagar conversa
      </button> : <>
        <span>Isso remove todo o conteúdo do chat.</span>
        <button type="button" disabled={pending} onClick={deleteConversation}>Confirmar exclusão</button>
        <button type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
      </>}
    </div> : null}
    {error ? <p className="form-error assistant-error" role="alert">{error}</p> : null}

    <form className="assistant-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="assistant-message">Pergunte sobre investir</label>
      <input
        id="assistant-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Pergunte sobre investir…"
        maxLength={500}
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
        enterKeyHint="send"
        disabled={pending}
      />
      <button
        type="submit"
        aria-label="Enviar pergunta"
        disabled={pending || message.trim().length < 2}
      >↑</button>
    </form>
  </div>;
}
