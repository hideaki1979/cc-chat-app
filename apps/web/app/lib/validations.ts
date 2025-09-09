import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .email({ error: '有効なメールアドレスを入力してください' })
    .min(1, { error: 'メールアドレスは必須です' }),
  password: z
    .string()
    .min(1, { error: 'パスワードは必須です' })
    .min(8, { error: 'パスワードは8文字以上である必要があります' })
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      { error: 'パスワードは大文字、小文字、数字を含む必要があります' }
    ),
});

export const registerSchema = z
  .object({
    email: z
      .email({ message: '有効なメールアドレスを入力してください' })
      .min(1, { message: 'メールアドレスは必須です' }),
    username: z
      .string()
      .min(2, { message: 'ユーザー名は2文字以上である必要があります' })
      .max(30, { message: 'ユーザー名は30文字以下である必要があります' })
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        { message: 'ユーザー名には半角英数字、アンダースコア、ハイフンのみ使用できます' }
      ),
    password: z
      .string()
      .min(1, { message: 'パスワードは必須です' })
      .min(8, { message: 'パスワードは8文字以上である必要があります' })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'パスワードは大文字、小文字、数字を含む必要があります' }),
    confirmPassword: z
      .string()
      .min(1, { message: 'パスワードの確認は必須です' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;