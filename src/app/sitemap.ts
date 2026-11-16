import type { MetadataRoute } from "next";
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://usenorthapp.com.br";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/simular", "/termos", "/privacidade"].map((path) => ({ url: `${site}${path}`, changeFrequency: "monthly", priority: path === "/" ? 1 : 0.6 }));
}
