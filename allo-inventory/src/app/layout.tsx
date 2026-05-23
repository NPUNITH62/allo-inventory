import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Multi-warehouse inventory and reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <nav className="border-b border-slate-200 bg-white shadow-sm">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
            <span className="text-xl font-bold text-brand-700 tracking-tight">Allo</span>
            <span className="text-slate-400 text-sm">Inventory Platform</span>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
