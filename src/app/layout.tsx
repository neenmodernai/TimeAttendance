// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SecretMenu } from "@/components/SecretMenu";

export const metadata: Metadata = { title: "ลงเวลาและลางาน", description: "ระบบบันทึกเวลาเข้างานและแจ้งลาหยุด" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#4f46e5" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">{children}<SecretMenu /></body>
    </html>
  );
}
