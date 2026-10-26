import type { NextConfig } from "next";

// O Núcleo roda todo no navegador (dados protegidos pelas regras do Supabase),
// então pode ser publicado como site estático na Vercel.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
