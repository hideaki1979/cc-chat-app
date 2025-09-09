'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type LoginFormData } from '../lib/validations';
import { DEFAULT_LOGIN_REDIRECT } from '../constants/constants';

export const useLoginFormLogic = (
  login: (data: LoginFormData) => Promise<boolean>,
  clearError: () => void
) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleLogin = async (data: LoginFormData): Promise<void> => {
    clearError();
    const success = await login(data);

    if (success) {
      const redirect = searchParams.get('redirect');
      const safeRedirect =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : null;

      router.push(safeRedirect ?? DEFAULT_LOGIN_REDIRECT);
    }
  };

  return {
    handleLogin,
  };
};