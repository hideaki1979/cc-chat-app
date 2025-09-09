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
  }, [clearError]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  return {
    ...form,
    login,
    isLoading,
    error,
    clearError,
  };
};