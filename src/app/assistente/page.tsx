import Link from "next/link";
import { AssistantChat, type ChatMessage } from "@/features/assistant/assistant-chat";
import { deriveAssistantInsights } from "@/features/assistant/engine";
import { assistantReplySchema } from "@/features/assistant/schemas";
import type { AssistantReply } from "@/features/assistant/types";
import { loadAssistantContext } from "@/server/assistant/context";
import { createClient } from "@/server/supabase/client";

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured_payload: unknown;
  created_at: string;
};

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const supabase = await createClient();
  const [{ context }, threadResult] = await Promise.all([
    loadAssistantContext(supabase),
    supabase
      .from("assistant_threads")
      .select("id")
      .gt("expires_at", new Date().toISOString())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const threadId = threadResult.data?.id as string | undefined;
  const { data: messageRows } = threadId
    ? await supabase
      .from("assistant_messages")
      .select("id, role, content, structured_payload, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(40)
    : { data: [] };
  const messages = ((messageRows ?? []) as unknown as MessageRow[]).flatMap<ChatMessage>((message) => {
    if (message.role === "user") {
      return [{
        id: message.id,
        role: "user" as const,
        content: message.content,
        reply: null,
      }];
    }
    const parsed = assistantReplySchema.safeParse(message.structured_payload);
    if (!parsed.success) return [];
    return [{
      id: message.id,
      role: "assistant" as const,
      content: message.content,
      reply: parsed.data as AssistantReply,
    }];
  });

  return <main className="assistant-shell">
    <header className="assistant-header">
      <Link href="/inicio" aria-label="Voltar para o início">←</Link>
      <span className="assistant-orb" aria-hidden="true" />
      <div><strong>North</strong><small>modo seguro · educacional</small></div>
    </header>
    <AssistantChat
      initialThreadId={threadId ?? null}
      initialMessages={messages}
      insights={deriveAssistantInsights(context)}
    />
  </main>;
}
