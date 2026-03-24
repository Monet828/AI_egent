import type { Metadata, Viewport } from "next";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1D9E75",
};

export const metadata: Metadata = {
  title: "イエマッチAI | あなたにぴったりの住宅会社が見つかる",
  description:
    "19問の簡単な質問に答えるだけで、AIがあなたの家づくりタイプを診断。マッチ度の高い工務店を最大3社おすすめします。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased min-h-screen">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}
