import Link from 'next/link';
import { Button } from '@repo/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="relative z-10 flex flex-col gap-8 text-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-3xl p-12 sm:p-16 shadow-2xl border border-white/20 dark:border-gray-700/50 max-w-4xl w-full">
        <div className="text-center">
          <div>
            <h1 className="text-4xl sm:text-3xl lg:text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6 sm:mb-6">
              チャットアプリへようこそ
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-12">
              リアルタイムチャットを楽しみましょう！
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center">
            <Link href="/login">
              <Button variant="primary" size="lg" className="w-full sm:w-auto min-w-[220px]">
                ログイン
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto min-w-[220px]">
                新規登録
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
