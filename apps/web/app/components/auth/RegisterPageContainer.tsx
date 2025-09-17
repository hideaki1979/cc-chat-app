import { Suspense } from 'react';
import { RegisterForm } from '../RegisterForm';

// RegisterFormのローディング状態
function RegisterFormFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-md w-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20">
        <div className="text-center mb-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-300">読み込み中...</p>
        </div>
      </div>
    </div>
  );
}

// Server Componentとしてのコンテナ
export function RegisterPageContainer() {
  return (
    <Suspense fallback={<RegisterFormFallback />}>
      <RegisterForm />
    </Suspense>
  );
}