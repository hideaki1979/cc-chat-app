'use client';

import React, { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { Button } from '@repo/ui/button';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'メッセージを入力してください...',
  maxLength = 1000,
}) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // テキストエリアの最大高さを設定
  const MAX_TEXTAREA_HEIGHT = 120; // 約5行分

  // テキストエリアの高さを内容に応じて自動調整する関数
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [MAX_TEXTAREA_HEIGHT]);

  // ref callbackを使って、textarea要素がマウントされた時に高さを調整
  const textareaRef$ = useCallback(
    (node: HTMLTextAreaElement | null) => {
      if (node) {
        textareaRef.current = node;
        adjustTextareaHeight(node);
      }
    },
    [adjustTextareaHeight],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      setMessage(newValue);
      adjustTextareaHeight(e.target);
    }
  };

  const handleSendMessage = useCallback(() => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || disabled || isComposing) return;

    onSendMessage(trimmedMessage);
    setMessage('');

    // メッセージ送信後、テキストエリアの高さをリセット
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, disabled, isComposing, onSendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IME入力中は送信しない
    if (isComposing) return;

    // Shift+Enterで改行、Enterで送信
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const canSend = message.trim().length > 0 && !disabled && !isComposing;

  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="p-4">
        <div className="flex items-end space-x-3">
          {/* 添付ファイルボタン（将来の機能拡張用） */}
          <button
            type="button"
            className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="ファイルを添付（近日公開）"
            disabled={true} // 現在は無効
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>

          {/* メッセージ入力エリア */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef$}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-2xl px-4 py-3 pr-12 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] max-h-[120px] overflow-y-auto"
            />

            {/* 文字数カウンター */}
            {message.length > maxLength * 0.8 && (
              <div
                className={`absolute bottom-1 right-12 text-xs ${message.length >= maxLength
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
                  }`}
              >
                {message.length}/{maxLength}
              </div>
            )}
          </div>

          {/* 送信ボタン */}
          <Button
            onClick={handleSendMessage}
            disabled={!canSend}
            size="sm"
            variant="primary"
            className="flex-shrink-0 h-11 px-4 rounded-2xl"
            aria-label="メッセージを送信"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </Button>
        </div>

        {/* ショートカットヒント */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          <span className="inline-flex items-center space-x-4">
            <span>Enter: 送信</span>
            <span>Shift + Enter: 改行</span>
          </span>
        </div>
      </div>
    </div>
  );
};