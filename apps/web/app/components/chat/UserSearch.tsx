'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { searchUsers, createDirectMessage, type UserSearchResult, type ChatRoomResponse } from '../../lib/api';
import { useChatStore } from '../../stores/chat';

export interface User extends UserSearchResult {}

interface UserSearchProps {
  onUserSelect?: (user: User) => void;
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const UserSearch: React.FC<UserSearchProps> = ({
  onUserSelect,
  currentUserId,
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isStartingDM, setIsStartingDM] = useState(false);
  
  // チャットストアのアクションを取得
  const addRoom = useChatStore((state) => state.addRoom);

  // 検索実行
  const performUserSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const data = await searchUsers(query);
      // 自分を除外
      const filteredUsers = data.users?.filter((user: User) => user.id !== currentUserId) || [];
      setUsers(filteredUsers);
    } catch (err) {
      console.error('ユーザー検索エラー:', err);
      setError(err instanceof Error ? err.message : 'ユーザー検索に失敗しました');
      setUsers([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentUserId]);

  // デバウンス付き検索
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      performUserSearch(searchQuery);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, performUserSearch]);

  // DM開始処理
  const handleStartDM = async (user: User) => {
    setIsStartingDM(true);
    setSelectedUser(user);

    try {
      // APIクライアントを使用してDMを作成（既存があれば取得、なければ作成）
      const room: ChatRoomResponse = await createDirectMessage(user.id);
      
      // ストアに新しいルームを追加
      addRoom({
        id: room.id,
        name: room.name,
        is_group_chat: room.is_group_chat,
        member_count: room.member_count || 2, // DMの場合は2人
        last_message: room.last_message,
        updated_at: room.updated_at,
      });

      // ユーザー選択コールバックがあれば実行
      if (onUserSelect) {
        onUserSelect(user);
      }

      // DM画面に遷移
      router.push(`/dm/${room.id}`);
      onClose(); // 成功したらモーダルを閉じる
    } catch (err) {
      console.error('DM開始エラー:', err);
      setError(err instanceof Error ? err.message : 'DMの開始に失敗しました');
    } finally {
      setIsStartingDM(false);
      setSelectedUser(null);
    }
  };

  // モーダルが閉じられた時の処理
  const handleClose = () => {
    setSearchQuery('');
    setUsers([]);
    setError(null);
    setSelectedUser(null);
    onClose();
  };

  // ユーザーアバター表示
  const getUserAvatar = (user: User) => {
    if (user.profile_image_url) {
      return (
        <img
          src={user.profile_image_url}
          alt={`${user.name}のアバター`}
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    }

    return (
      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
        <span className="text-white text-sm font-bold">
          {user.name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            ユーザーを検索してDMを開始
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 検索フィールド */}
        <div className="p-6">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ユーザー名またはメールアドレスで検索..."
            className="w-full"
            disabled={isSearching}
          />
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* 検索結果 */}
        <div className="flex-1 overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">検索中...</span>
              </div>
            </div>
          )}

          {!isSearching && searchQuery && users.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">ユーザーが見つかりませんでした</p>
            </div>
          )}

          {!isSearching && !searchQuery && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">ユーザー名またはメールアドレスを入力してください</p>
            </div>
          )}

          {users.length > 0 && (
            <div className="px-6 pb-6">
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getUserAvatar(user)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleStartDM(user)}
                      disabled={isStartingDM}
                      className="ml-3"
                    >
                      {isStartingDM && selectedUser?.id === user.id ? (
                        <div className="flex items-center space-x-2">
                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>開始中...</span>
                        </div>
                      ) : (
                        'DM開始'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};