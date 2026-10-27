import type { Metadata, Viewport } from "next";
// Fontes hospedadas junto com o sistema (sem depender do Google em tempo de execução)
import "@fontsource/sora/600.css";
import "@fontsource/sora/700.css";
import "@fontsource/sora/800.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Núcleo BRA",
  description: "Gestão da BRA Ambientes Inteligentes",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Núcleo BRA", statusBarStyle: "black-translucent" },
  icons: { icon: "/icone-nucleo.png", apple: "/icone-nucleo-180.png" },
};
export const viewport: Viewport = { themeColor: "#19295a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
