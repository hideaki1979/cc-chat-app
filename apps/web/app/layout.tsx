import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthInit } from "./components/AuthInit";
import { ErrorBoundary } from "./components/ErrorBoundary";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});

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
    <html lang="ja">
      <body className={`${geistSans.variable}`}>
        <ErrorBoundary>
          <AuthInit />
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
