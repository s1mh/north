import { NextResponse } from "next/server";
import {
  QUESTIONNAIRE_VERSION,
  scoreAnswers,
} from "@/features/suitability/questionnaire";
import { suitabilitySubmissionSchema } from "@/features/suitability/submission";
import { createClient } from "@/server/supabase/client";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers: privateHeaders });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: privateHeaders });
  }

  const input = await request.json().catch(() => null);
  const parsed = suitabilitySubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({ error: "Respostas inválidas." }, { status: 400, headers: privateHeaders });
  }

  let result: ReturnType<typeof scoreAnswers>;
  try {
    result = scoreAnswers(parsed.data.answers);
  } catch {
    return NextResponse.json({ error: "Responda todo o questionário." }, { status: 400, headers: privateHeaders });
  }

  const { error } = await supabase.rpc("complete_suitability", {
    p_answers: parsed.data.answers,
    p_questionnaire_version: QUESTIONNAIRE_VERSION,
  });
  if (error) {
    return NextResponse.json(
      { error: "Não foi possível salvar seu perfil agora." },
      { status: 500, headers: privateHeaders },
    );
  }

  return NextResponse.json(result, { headers: privateHeaders });
}
