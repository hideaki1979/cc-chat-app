'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { FormCard, FormHeader, FormContainer, FormFields, FormFooter } from '@repo/ui/form-card';
import { useAuthStore } from '../stores/auth';
import { loginSchema, type LoginFormData } from '../lib/validations';

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data);
      router.push('/dashboard'); // ダッシュボードページにリダイレクト
    } catch (err) {
      // エラーはstoreで処理済みだが、必要に応じて追加の処理を行う
      console.error('Login failed:', err);
      // 必要に応じてここでトースト通知やログ送信などを行う
    }
  };

  const loginIcon = (
    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  const subtitle = (
    <>
      アカウントをお持ちでない場合は{' '}
      <Link href="/register" className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
        新規登録
      </Link>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 px-4 sm:px-4 lg:px-6">
      <div className="max-w-lg w-full">
        <FormCard>
          <FormHeader
            title="アカウントにログイン"
            subtitle={subtitle}
            icon={loginIcon}
          />

          <FormContainer onSubmit={handleSubmit(onSubmit)}>
            <FormFields>
              <Input
                label="メールアドレス"
                type="email"
                autoComplete="email"
                {...register('email')}
                error={errors.email?.message}
                placeholder="example@email.com"
              />

              <Input
                label="パスワード"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                error={errors.password?.message}
                placeholder="パスワードを入力"
              />
            </FormFields>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-4 rounded-xl flex items-center mt-6">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="pt-1">
              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full"
                size="sm"
              >
                ログイン
              </Button>
            </div>
          </FormContainer>

          <FormFooter>
            ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます。
          </FormFooter>
        </FormCard>
      </div>
    </div>
  );
};