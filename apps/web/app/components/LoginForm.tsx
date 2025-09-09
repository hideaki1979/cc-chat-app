'use client';

import React from 'react';
import { LoginFormUI } from './ui/LoginFormUI';
import { useLoginForm } from '../hooks/useLoginForm';
import { useLoginFormLogic } from '../lib/login-form-logic';

export const LoginForm: React.FC = () => {
  const {
    handleSubmit,
    formState: { errors },
    registerField,
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
      registerField={registerField}
      errors={errors}
      error={error}
      isLoading={isLoading}
    />
  );
};