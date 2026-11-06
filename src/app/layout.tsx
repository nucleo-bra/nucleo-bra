import type { Metadata, Viewport } from "next";
// Inter (hospedada junto) para quem não tem a fonte do sistema Apple (SF Pro)
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Núcleo BRA",
  description: "Gestão da BRA Ambientes Inteligentes",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Núcleo BRA", statusBarStyle: "default" },
  icons: { icon: "/icone-nucleo.png", apple: "/icone-nucleo-180.png" },
};
export const viewport: Viewport = { themeColor: "#f5f5f7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
