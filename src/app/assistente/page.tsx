import { AssistantChat, type ChatAction, type ChatMessage, type ThreadItem } from "@/features/assistant/assistant-chat";
import { describeAction, type ActionKind, type ActionStatus } from "@/features/assistant/actions";
import { deriveAssistantInsights } from "@/features/assistant/engine";
import { loadAssistantContext } from "@/server/assistant/context";
import { createClient } from "@/server/supabase/client";

type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ActionRow = {
  id: string;
  message_id: string;
  kind: ActionKind;
  status: ActionStatus;
  payload: unknown;
};

export const dynamic = "force-dynamic";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: claimsData }, { context }, threadsResult, assetsResult, goalsResult] = await Promise.all([
    supabase.auth.getClaims(),
    loadAssistantContext(supabase),
    supabase
      .from("assistant_threads")
      .select("id, title, updated_at")
      .gt("expires_at", now)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase.from("portfolio_instruments").select("id", { count: "exact", head: true }),
    supabase.from("goals").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);
  const threads = (threadsResult.data ?? []) as ThreadItem[];
  // O primeiro nome só é usado na tela (saudação); nunca vai para o provedor de IA.
  const fullName = (claimsData?.claims?.user_metadata as { display_name?: unknown } | undefined)?.display_name;
  const firstName = typeof fullName === "string" ? fullName.trim().split(/\s+/)[0] ?? "" : "";

  // "nova" abre uma conversa vazia; sem parâmetro, retoma a mais recente.
  const wantsNew = c === "nova";
  const selected = wantsNew
    ? null
    : threads.find((thread) => thread.id === c) ?? (c ? null : threads[0] ?? null);

  let messages: ChatMessage[] = [];
  if (selected) {
    const { data: rows } = await supabase
      .from("assistant_messages")
      .select("id, role, content")
      .eq("thread_id", selected.id)
      .order("created_at", { ascending: true })
      .limit(80);
    const messageRows = (rows ?? []) as MessageRow[];
    const assistantIds = messageRows.filter((row) => row.role === "assistant").map((row) => row.id);
    const { data: actionRows } = assistantIds.length > 0
      ? await supabase
        .from("assistant_actions")
        .select("id, message_id, kind, status, payload")
        .in("message_id", assistantIds)
      : { data: [] };
    const actionsByMessage = new Map<string, ChatAction[]>();
    for (const row of (actionRows ?? []) as ActionRow[]) {
      const list = actionsByMessage.get(row.message_id) ?? [];
      list.push({ id: row.id, kind: row.kind, status: row.status, view: describeAction(row.kind, row.payload) });
      actionsByMessage.set(row.message_id, list);
    }
    messages = messageRows.map((row) => ({
      id: row.id,
      role: row.role,
      text: row.content,
      actions: actionsByMessage.get(row.id) ?? [],
    }));
  }

  return <main className="assistant-shell">
    <AssistantChat
      key={selected?.id ?? "nova"}
      hasAssets={(assetsResult.count ?? 0) > 0}
      hasGoals={(goalsResult.count ?? 0) > 0}
      firstName={firstName}
      threads={threads}
      initialThreadId={selected?.id ?? null}
      initialMessages={messages}
      insights={deriveAssistantInsights(context)}
    />
  </main>;
}
