import type { Metadata } from "next";
import "./globals.css";
import { AuthInit } from "./components/AuthInit";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { inter, notoSansJP, geistSans } from "./fonts";

export const metadata: Metadata = {
  title: "CC Chat",
  description: "Real-time chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable} ${geistSans.variable}`}>
      <body className="font-sans">
        <ErrorBoundary>
          <AuthInit />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
