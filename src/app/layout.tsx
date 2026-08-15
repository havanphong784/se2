import type { Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VocaBloom — Học tiếng Anh mỗi ngày",
    template: "%s | VocaBloom",
  },
  description:
    "Học từ vựng tiếng Anh bằng flashcard, ôn tập ngắt quãng và lộ trình hằng ngày.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${nunito.variable} ${baloo.variable}`} suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
