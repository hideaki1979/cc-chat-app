'use client';

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { api } from '../lib/api';
import type { 
  AuthStore, 
  LoginCredentials, 
  RegisterCredentials, 
  AuthResponse 
} from '../types/auth';

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        // State
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        error: null,

        // Actions
        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },

        setError: (error: string | null) => {
          set({ error });
        },

        clearError: () => {
          set({ error: null });
        },

        login: async (credentials: LoginCredentials) => {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);

            const response = await api.post<AuthResponse>('/auth/login', credentials);
            const { user, accessToken, refreshToken } = response.data;

            // Store tokens in localStorage for persistence
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', refreshToken);
            }

            set({
              user,
              accessToken,
              refreshToken,
              isLoading: false,
              error: null,
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error 
              ? error.message 
              : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'ログインに失敗しました';
            set({
              isLoading: false,
              error: errorMessage,
              user: null,
              accessToken: null,
              refreshToken: null,
            });
            
            // Clear tokens from localStorage
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
            }
            throw error;
          }
        },

        register: async (credentials: RegisterCredentials) => {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);

            const response = await api.post<AuthResponse>('/auth/register', credentials);
            const { user, accessToken, refreshToken } = response.data;

            // Store tokens in localStorage for persistence
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', refreshToken);
            }

            set({
              user,
              accessToken,
              refreshToken,
              isLoading: false,
              error: null,
            });
          } catch (error: unknown) {
            const errorMessage = error instanceof Error 
              ? error.message 
              : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '登録に失敗しました';
            set({
              isLoading: false,
              error: errorMessage,
              user: null,
              accessToken: null,
              refreshToken: null,
            });
            
            // Clear tokens from localStorage
            if (typeof window !== 'undefined') {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
            }
            throw error;
          }
        },

        logout: () => {
          // Clear tokens from localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }

          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            error: null,
          });
        },

        refreshAccessToken: async () => {
          const state = get();
          const refreshTokenValue = state.refreshToken;
          
          if (!refreshTokenValue) {
            throw new Error('No refresh token available');
          }

          try {
            const response = await api.post<{ accessToken: string }>('/auth/refresh', {
              refreshToken: refreshTokenValue,
            });
            
            const { accessToken } = response.data;

            // Store new token in localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('accessToken', accessToken);
            }

            set({ accessToken });
          } catch (error) {
            // Refresh failed, logout user
            state.logout();
            throw error;
          }
        },
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);