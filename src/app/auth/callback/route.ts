import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthenticatedDestination } from "@/features/auth/onboarding";
import { createClient } from "@/server/supabase/client";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/onboarding/bancos";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (destination === "/redefinir-senha") {
        return NextResponse.redirect(new URL(destination, request.url));
      }
      const [{ data: profile }, { count: linkedInstitutionCount }] = await Promise.all([
        supabase
          .from("profiles")
          .select("onboarding, current_assessment_id")
          .maybeSingle(),
        supabase
          .from("user_institutions")
          .select("*", { count: "exact", head: true }),
      ]);
      return NextResponse.redirect(new URL(resolveAuthenticatedDestination({
        onboarding: profile?.onboarding,
        currentAssessmentId: profile?.current_assessment_id,
        linkedInstitutionCount,
      }), request.url));
    }
  }

  return NextResponse.redirect(new URL("/entrar?erro=confirmacao", request.url));
}
