// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SecretMenu, TripleTap } from "@/components/SecretMenu";

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
      <body className="min-h-screen bg-slate-50 text-slate-800 antialiased">{children}
        <footer className="pb-24 pt-6 text-center text-[11px] text-slate-300">
          {/* owner-only developer menu: triple-tap the copyright line */}
          <TripleTap target="dev">© 2026 Time Attendance &amp; Leave Management System</TripleTap>
        </footer>
        <SecretMenu />
      </body>
    </html>
  );
}
