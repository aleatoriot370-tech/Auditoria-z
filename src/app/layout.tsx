import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// ⚠️ Use Sonner's Toaster (NOT @/components/ui/toaster which is the old system
// based on react-toastify/use-toast hook — our components import `toast` from `sonner`).
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lamoia Audit | Auditoria de Rota de Vendas",
  description: "Sistema de auditoria e acompanhamento de rota de vendas — Grupo Lamoia.",
  keywords: ["Lamoia", "auditoria", "rota", "vendas", "agenda"],
  authors: [{ name: "Grupo Lamoia" }],
  icons: {
    icon: "/logo-lamoia.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={6000}
        />
      </body>
    </html>
  );
}
