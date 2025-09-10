import { searchUsers } from '../api';
import type { UserSearchResult } from '../../types/user';

/**
 * ユーザー関連のビジネスロジックを管理するサービス層
 * Server Components/Client Components両方で使用可能
 */

/**
 * ユーザー検索を実行
 * @param query - 検索クエリ
 * @param currentUserId - 現在のユーザーID（検索結果から除外）
 * @returns Promise<UserSearchResult[]>
 */
export const performUserSearch = async (
  query: string, 
  currentUserId?: string
): Promise<UserSearchResult[]> => {
  const trimmedQuery = query.trim();
  
  // バリデーション - ビジネスルール
  if (!trimmedQuery) {
    return [];
  }
  
  if (trimmedQuery.length < 2) {
    throw new Error('検索は2文字以上で入力してください');
  }
  
  if (trimmedQuery.length > 50) {
    throw new Error('検索キーワードは50文字以内で入力してください');
  }

  try {
    const data = await searchUsers(trimmedQuery);
    
    // 自分を検索結果から除外 - ビジネスルール
    const filteredUsers = data.users?.filter((user: UserSearchResult) => 
      user.id !== currentUserId
    ) || [];
    
    return filteredUsers;
  } catch (error) {
    throw new Error(`ユーザー検索に失敗しました: ${error}`);
  }
};

/**
 * 検索クエリの妥当性を検証
 * @param query - 検索クエリ
 * @returns バリデーション結果
 */
export const validateSearchQuery = (query: string): { isValid: boolean; error?: string } => {
  const trimmed = query.trim();
  
  if (!trimmed) {
    return { isValid: false, error: '検索キーワードを入力してください' };
  }
  
  if (trimmed.length < 2) {
    return { isValid: false, error: '検索は2文字以上で入力してください' };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, error: '検索キーワードは50文字以内で入力してください' };
  }
  
  return { isValid: true };
};

/**
 * ユーザーの表示名を生成
 * ビジネスルール：名前が存在しない場合はメールアドレスを使用
 * @param user - ユーザー情報
 * @returns 表示名
 */
export const getUserDisplayName = (user: UserSearchResult): string => {
  return user.name?.trim() || user.email || 'Unknown User';
};

/**
 * ユーザーアバター用の初期文字を取得
 * ビジネスルール：名前の最初の文字、なければメールの最初の文字
 * @param user - ユーザー情報
 * @returns 初期文字（大文字）
 */
export const getUserInitial = (user: UserSearchResult): string => {
  const name = user.name?.trim();
  if (name) {
    return name.charAt(0).toUpperCase();
  }
  
  const email = user.email?.trim();
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  
  return 'U'; // Unknown User
};

/**
 * デバウンス処理のための遅延時間を計算
 * ビジネスルール：検索の負荷を考慮した最適な遅延
 * @param queryLength - クエリの長さ
 * @returns 遅延時間（ミリ秒）
 */
export const calculateSearchDebounceDelay = (queryLength: number): number => {
  // 短いクエリほど長い遅延（誤入力を避ける）
  if (queryLength <= 2) return 800;
  if (queryLength <= 4) return 500;
  return 300; // 長いクエリは短い遅延
};