'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../stores/auth';
import { loginSchema, type LoginFormData } from '../lib/validations';

export const useLoginForm = () => {
  const { login, isLoading, error, clearError } = useAuthStore();

  // 画面遷移後の古いエラーを初期化
  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const registerField = (name: 'email' | 'password') => form.register(name);

  return {
    ...form,
    registerField,
    login,
    isLoading,
    error,
    clearError,
  };
};