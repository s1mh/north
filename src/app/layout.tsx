import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { PwaClient } from "@/features/pwa/pwa-client";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://usenorthapp.com.br"),
  title: { default: "north. Comece a investir sabendo o que faz", template: "%s · north." },
  description: "Para quem está começando: entenda Tesouro, CDB e ação, simule um aporte pequeno e acompanhe a sua carteira, no seu ritmo.",
  openGraph: {
    type: "website", locale: "pt_BR", siteName: "north.",
    title: "north. Comece a investir sabendo o que faz",
    description: "Para quem está começando: entenda Tesouro, CDB e ação, simule um aporte pequeno e acompanhe a sua carteira, no seu ritmo.",
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  icons: [
    { rel: "icon", url: "/icon.svg" },
    { rel: "apple-touch-icon", url: "/icon-192.png" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "North",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFEDE7" },
    { media: "(prefers-color-scheme: dark)", color: "#1B1814" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("north-theme")?.value;
  const theme = cookieTheme === "light" || cookieTheme === "dark"
    ? cookieTheme
    : "system";

  return <html lang="pt-BR" data-theme={theme} className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
    <body>{children}<PwaClient /></body>
  </html>;
}
