import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAuthenticatedDestination } from "@/features/auth/onboarding";
import { getPublicEnv } from "@/server/env/public";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const redirect = NextResponse.redirect(new URL("/entrar", request.url));
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }
  const isOnboardingRoute = request.nextUrl.pathname.startsWith("/onboarding/");
  const isPasswordResetRoute = request.nextUrl.pathname.startsWith("/redefinir-senha");
  if (!isOnboardingRoute && !isPasswordResetRoute) {
    const [profileResult, institutionResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("onboarding, current_assessment_id")
        .maybeSingle(),
      supabase
        .from("user_institutions")
        .select("*", { count: "exact", head: true }),
    ]);
    if (!profileResult.error && profileResult.data) {
      const destination = resolveAuthenticatedDestination({
        onboarding: profileResult.data.onboarding,
        currentAssessmentId: profileResult.data.current_assessment_id,
        linkedInstitutionCount: institutionResult.count,
      });
      if (destination !== "/inicio") {
        const redirect = NextResponse.redirect(new URL(destination, request.url));
        for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
        return redirect;
      }
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/inicio/:path*",
    "/investir/:path*",
    "/carteira/:path*",
    "/mercado/:path*",
    "/assistente/:path*",
    "/metas/:path*",
    "/produtos/:path*",
    "/perfil/:path*",
    "/onboarding/:path*",
    "/redefinir-senha/:path*",
  ],
};
