import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.16.24.*", "10.70.96.*", "192.168.0.*"],
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
    {
      // Headers de segurança aplicados a todas as rotas. Instruem o navegador a
      // se comportar de forma mais restritiva — não alteram o funcionamento do
      // app. CSP foi deixada para uma etapa posterior (exige nonce no script
      // inline do service worker + teste tela a tela).
      source: "/:path*",
      headers: [
        // Impede que o sistema seja embutido em <iframe> de outro site
        // (proteção contra clickjacking). SAMEORIGIN: permite só a própria origem.
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        // Proíbe o navegador de "adivinhar" o tipo do arquivo (MIME sniffing).
        { key: "X-Content-Type-Options", value: "nosniff" },
        // Limita o quanto do endereço atual vaza ao navegar para fora.
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        // HSTS — força HTTPS no navegador. Só faz sentido DEPOIS que o servidor
        // estiver servindo por HTTPS; manter comentado até a infra definir isso,
        // senão pode travar o acesso em http durante testes.
        // { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    },
  ],
};

export default nextConfig;
