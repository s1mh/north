import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "North", template: "%s · North" },
  description: "Educação financeira, carteira e metas em uma direção só.",
  manifest: "/manifest.webmanifest",
  icons: [{ rel: "icon", url: "/icon.svg" }],
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#EFEDE7" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
