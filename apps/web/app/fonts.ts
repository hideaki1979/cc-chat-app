import { Inter, Noto_Sans_JP } from 'next/font/google';
import localFont from 'next/font/local';

// Google Fonts最適化
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

export const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
  preload: true,
  // 日本語フォントは重いため、必要な文字セットを指定
  weight: ['400', '500', '600', '700'],
});

// 既存のローカルフォント（デザインアクセント用）
export const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  display: 'swap',
  preload: false, // ローカルフォントはpreloadを無効化して警告を防止
});