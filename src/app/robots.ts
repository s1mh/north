import type { MetadataRoute } from "next";
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usenorthapp.com.br";
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/simular", "/termos", "/privacidade"], disallow: ["/api/", "/inicio", "/carteira", "/metas", "/investir", "/assistente", "/perfil", "/onboarding"] }, sitemap: `${site}/sitemap.xml` };
}
