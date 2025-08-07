import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .email('有効なメールアドレスを入力してください')
    .min(1, 'メールアドレスは必須です'),
  password: z
    .string()
    .min(6, 'パスワードは6文字以上である必要があります')
    .min(1, 'パスワードは必須です'),
});

export const registerSchema = z
  .object({
    email: z
      .string()
      .email('有効なメールアドレスを入力してください')
      .min(1, 'メールアドレスは必須です'),
    username: z
      .string()
      .min(2, 'ユーザー名は2文字以上である必要があります')
      .max(30, 'ユーザー名は30文字以下である必要があります')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'ユーザー名には半角英数字、アンダースコア、ハイフンのみ使用できます'
      ),
    password: z
      .string()
      .min(8, 'パスワードは8文字以上である必要があります')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'パスワードは大文字、小文字、数字を含む必要があります'
      ),
    confirmPassword: z
      .string()
      .min(1, 'パスワードの確認は必須です'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;