/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // デフォルトsansフォント: Noto Sans JP (日本語メイン) → Inter (英数字) → system fallback
        sans: ['var(--font-noto-sans-jp)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        // 英数字メインの場合: Inter → Noto Sans JP → system fallback
        inter: ['var(--font-inter)', 'var(--font-noto-sans-jp)', 'system-ui', 'sans-serif'],
        // デザインアクセント用: Geist
        geist: ['var(--font-geist-sans)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
}