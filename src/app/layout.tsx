import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { PwaClient } from "@/features/pwa/pwa-client";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "North", template: "%s · North" },
  description: "Educação financeira, carteira e metas em uma direção só.",
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

  return <html lang="pt-BR" data-theme={theme} suppressHydrationWarning>
    <body>{children}<PwaClient /></body>
  </html>;
}
