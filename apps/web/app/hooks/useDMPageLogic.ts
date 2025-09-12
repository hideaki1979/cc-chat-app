'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { getChatRoom } from '../lib/api';

/**
 * DMページの複雑な副作用を統合管理するカスタムフック
 * 
 * 従来の5つのuseEffectを目的別に最適化:
 * 1. 認証初期化フロー
 * 2. ルーム関連データ管理
 * 3. アクセス制御とリダイレクト
 */
export function useDMPageLogic(roomId: string) {
  const router = useRouter();
  const pathname = usePathname();

  // Store状態
  const { user, isLoading: authLoading, isInitialized, initializeAuth } = useAuthStore();
  const { rooms, currentRoomId, setCurrentRoom, loadRooms, updateRoom, isLoading } = useChatStore();
  
  // 重複実行防止用Ref
  const fetchedRoomRef = useRef<string | null>(null);

  // 現在のルーム情報を計算
  const currentRoom = rooms.find(room => room.id === roomId);
  const isDM = currentRoom && !currentRoom.is_group_chat;

  /**
   * Phase 1: 認証とデータ初期化フロー
   * 依存関係: 認証初期化 → ユーザー検証 → ルームデータロード
   */
  useEffect(() => {
    // Step 1: 認証初期化（1度だけ実行）
    if (!isInitialized) {
      initializeAuth().catch(() => {
        console.error('認証初期化に失敗しました');
      });
      return;
    }

    // Step 2: 認証確認とリダイレクト判定
    if (isInitialized && !authLoading) {
      if (!user) {
        // 未ログインの場合、即座にリダイレクト
        const redirectTo = encodeURIComponent(pathname);
        router.replace(`/login?redirect=${redirectTo}`);
        return;
      }

      // Step 3: ログイン済みかつルームデータ未ロードの場合
      if (user && rooms.length === 0) {
        loadRooms();
      }
    }
  }, [isInitialized, authLoading, user, rooms.length, pathname, router, initializeAuth, loadRooms]);

  /**
   * Phase 2: ルーム固有の処理
   * roomIdが確定してからの処理を統合
   */
  useEffect(() => {
    if (!user || !roomId) return;

    // Step 1: 現在のルーム設定
    if (currentRoomId !== roomId) {
      setCurrentRoom(roomId);
    }

    // Step 2: DM詳細取得（未取得かつ重複防止）
    if (isDM && !currentRoom?.members?.length && fetchedRoomRef.current !== roomId) {
      fetchedRoomRef.current = roomId;
      
      let cancelled = false;
      
      (async () => {
        try {
          const detail = await getChatRoom(roomId);
          if (!cancelled && detail?.members?.length) {
            updateRoom(roomId, { members: detail.members });
          }
        } catch (error) {
          console.error('ルーム詳細取得に失敗しました', error);
        }
      })();

      return () => {
        cancelled = true;
      };
    }
  }, [user, roomId, currentRoomId, isDM, currentRoom?.members?.length, setCurrentRoom, updateRoom]);

  /**
   * 相手のユーザー名を取得するヘルパー関数
   */
  const getOtherUserName = useCallback(() => {
    if (isDM && currentRoom?.members && user) {
      const other = currentRoom.members.find(m => m.user_id !== user.id);
      return other?.name || '相手';
    }
    return currentRoom?.name || 'チャットルーム';
  }, [isDM, currentRoom, user]);

  return {
    // 基本情報
    roomId,
    currentRoom,
    isDM,
    otherUserName: getOtherUserName(),
    
    // 状態
    isLoading: !isInitialized || authLoading || isLoading,
    isAuthenticated: isInitialized && !authLoading && !!user,
    user,
    
    // ナビゲーション
    router
  };
}