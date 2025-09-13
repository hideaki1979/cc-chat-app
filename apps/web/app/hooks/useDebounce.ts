'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * デバウンス機能を提供するカスタムフック
 * 
 * useEffectの乱用を防ぎ、デバウンス処理を再利用可能にする
 * タイマー管理とクリーンアップを適切に処理
 */
export function useDebounce<T extends unknown[]>(
  callback: (...args: T) => void,
  delay: number
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // 最新のコールバックを保持（依存配列問題を回避）
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // デバウンス実行関数
  const debouncedCallback = useCallback((...args: T) => {
    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 新しいタイマーを設定
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * 動的デリー付きデバウンスフック
 * 
 * 検索クエリ長などに基づいてデリーを動的計算
 */
export function useDynamicDebounce<T extends unknown[]>(
  callback: (...args: T) => void,
  getDelay: (...args: T) => number
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);
  const getDelayRef = useRef(getDelay);

  // 最新の関数を保持
  useEffect(() => {
    callbackRef.current = callback;
    getDelayRef.current = getDelay;
  }, [callback, getDelay]);

  const debouncedCallback = useCallback((...args: T) => {
    // 既存のタイマーをクリア
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 動的デリーを計算
    const delay = getDelayRef.current(...args);

    // 新しいタイマーを設定
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}