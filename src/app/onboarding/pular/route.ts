import { NextResponse } from "next/server";

// Marca, neste aparelho, que a pessoa quer entrar sem concluir o onboarding.
// Não grava nada no banco: o perfil continua sem avaliação e o assistente usa o modelo Moderado.
const SKIP_ONBOARDING_COOKIE = "north-onboarding-skip";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/inicio", request.url));
  response.cookies.set(SKIP_ONBOARDING_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
