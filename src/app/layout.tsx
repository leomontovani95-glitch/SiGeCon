import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SiGeCon — Sistema de Gestão de Conduta",
  description: "Sistema de Gestão de Conduta Escolar — EsFAP / EsFO / APM-ES",
  manifest: "/manifest.json",
  // Favicon: brasão da APM/ES redimensionado (public/icon.png). Referência
  // explícita para funcionar em dev e produção; apple-touch usa o ícone de 192px.
  icons: {
    icon: "/icon.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SiGeCon" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#1e3a5f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1e3a5f" />
      </head>
      <body className={`${inter.className} h-full bg-gray-50`}>
        {children}
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}`,
          }}
        />
      </body>
    </html>
  );
}
