import type { NextConfig } from "next";
import { writeFileSync } from "node:fs";

// O Núcleo roda todo no navegador (dados protegidos pelas regras do Supabase),
// então pode ser publicado como site estático na Vercel.
// A versão de cada publicação vai para /versao.json: o app aberto no celular
// compara com a que está rodando e se atualiza sozinho.
const versao = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 10) || Date.now().toString(36);
try { writeFileSync("public/versao.json", JSON.stringify({ versao })); } catch { /* só leitura: segue sem */ }

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  env: { NEXT_PUBLIC_VERSAO: versao },
};

export default nextConfig;
