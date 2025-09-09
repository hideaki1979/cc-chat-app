'use client';

import React from 'react';
import { LoginFormUI } from './ui/LoginFormUI';
import { useLoginForm } from '../hooks/useLoginForm';
import { useLoginFormLogic } from '../hooks/useLoginFormLogic';

export const LoginForm: React.FC = () => {
  const {
    handleSubmit,
    formState: { errors },
    register,
    login,
    isLoading,
    error,
    clearError,
  } = useLoginForm();

  const { handleLogin } = useLoginFormLogic(login, clearError);

  const onSubmit = handleSubmit(handleLogin);

  return (
    <LoginFormUI
      onSubmit={onSubmit}
      register={register}
      errors={errors}
      error={error}
      isLoading={isLoading}
    />
  );
};