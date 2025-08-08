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
import { registerSchema, type RegisterFormData } from '../lib/validations';

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      clearError();
      await registerUser(data);
      router.push('/dashboard'); // ダッシュボードページにリダイレクト
    } catch (err) {
      // エラーはstoreで処理済みだが、必要に応じて追加の処理を行う
      console.error('Registration failed:', err);
      // 必要に応じてここでトースト通知やログ送信などを行う
    }
  };

  const registerIcon = (
    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );

  const subtitle = (
    <>
      すでにアカウントをお持ちの場合は{' '}
      <Link href="/login" className="font-semibold text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors">
        ログイン
      </Link>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-4 px-4 sm:px-4 lg:px-6">
      <div className="max-w-lg w-full">
        <FormCard>
          <FormHeader
            title="新規アカウント作成"
            subtitle={subtitle}
            icon={registerIcon}
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
                label="ユーザー名"
                type="text"
                autoComplete="username"
                {...register('username')}
                error={errors.username?.message}
                placeholder="ユーザー名を入力"
                helperText="半角英数字、アンダースコア、ハイフンのみ使用可能"
              />

              <Input
                label="パスワード"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                error={errors.password?.message}
                placeholder="パスワードを入力"
                helperText="8文字以上、大文字・小文字・数字を含む"
              />

              <Input
                label="パスワード確認"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
                error={errors.confirmPassword?.message}
                placeholder="パスワードを再入力"
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
                アカウント作成
              </Button>
            </div>
          </FormContainer>

          <FormFooter>
            アカウントを作成することで、
            <Link href="/terms" className="text-purple-600 hover:text-purple-500 underline">
              利用規約
            </Link>
            と
            <Link href="/privacy" className="text-purple-600 hover:text-purple-500 underline">
              プライバシーポリシー
            </Link>
            に同意したものとみなされます。
          </FormFooter>
        </FormCard>
      </div>
    </div>
  );
};