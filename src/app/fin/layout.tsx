import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BRA Financeiro",
  description: "Financeiro da BRA Ambientes — integrado ao Núcleo",
  manifest: "/fin/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BRA Financeiro", statusBarStyle: "black-translucent" },
  icons: { icon: "/icone-financeiro.png", apple: "/icone-financeiro-180.png" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
