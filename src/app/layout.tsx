import type { Metadata, Viewport } from "next";
// Fontes hospedadas junto com o sistema (sem depender do Google em tempo de execução)
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Núcleo BRA",
  description: "Gestão da BRA Ambientes Inteligentes",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Núcleo BRA", statusBarStyle: "black-translucent" },
  icons: { icon: "/icone-nucleo.png", apple: "/icone-nucleo-180.png" },
};
export const viewport: Viewport = { themeColor: "#0f1a33", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
