'use client';

import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { Button } from '@repo/ui/button';
import { EmojiPicker } from './EmojiPicker';
import { useFileUpload, type UploadedFile } from '../../hooks/useFileUpload';

interface MessageInputProps {
  onSendMessage: (content: string, attachments?: UploadedFile[]) => void | Promise<void>;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  allowFileUpload?: boolean;
  allowEmoji?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  disabled = false,
  placeholder = 'メッセージを入力してください...',
  maxLength = 1000,
  allowFileUpload = true,
  allowEmoji = true,
}) => {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // テキストエリアの最大高さを設定
  const MAX_TEXTAREA_HEIGHT = 120; // 約5行分

  // ファイルアップロード機能
  const { uploadFile, isUploading, error: uploadError } = useFileUpload({
    onSuccess: (fileUrl, fileName) => {
      // アップロード成功時に添付ファイルリストに追加
      const newAttachment: UploadedFile = {
        id: Date.now().toString(),
        url: fileUrl,
        name: fileName,
        size: 0, // サイズは後で取得可能
        type: '',
      };
      setAttachments(prev => [...prev, newAttachment]);
    },
    onError: (error) => {
      console.error('ファイルアップロードエラー:', error);
    },
  });

  // タイピング通知の処理
  const handleTypingStart = useCallback(() => {
    if (!isTyping && onTypingStart) {
      setIsTyping(true);
      onTypingStart();
    }
  }, [isTyping, onTypingStart]);

  const handleTypingStop = useCallback(() => {
    if (isTyping && onTypingStop) {
      setIsTyping(false);
      onTypingStop();
    }
  }, [isTyping, onTypingStop]);

  // タイピング停止のタイマーをリセット
  const resetTypingTimer = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingStop();
    }, 2000); // 2秒間入力がなければタイピング停止
  }, [handleTypingStop]);

  // コンポーネントアンマウント時にタイマーをクリア
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      // アンマウント時にタイピング停止を送信（idempotent）
      handleTypingStop()
    };
  }, [handleTypingStop]);

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

      // タイピング通知
      if (newValue.trim() && !isComposing) {
        handleTypingStart();
        resetTypingTimer();
      } else if (!newValue.trim()) {
        handleTypingStop();
      }
    }
  };

  const handleSendMessage = useCallback(async () => {
    const trimmedMessage = message.trim();
    if ((!trimmedMessage && attachments.length === 0) || disabled || isComposing) return;

    // タイピング停止
    handleTypingStop();

    await onSendMessage(trimmedMessage, attachments);
    setMessage('');
    setAttachments([]);
    setShowEmojiPicker(false);

    // メッセージ送信後、テキストエリアの高さをリセット
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [message, attachments, disabled, isComposing, onSendMessage, handleTypingStop]);

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

  // ファイル選択ハンドラ
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file) {
      await uploadFile(file);
    }

    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [uploadFile]);

  // ファイル添付ボタンクリック
  const handleAttachClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // 添付ファイル削除
  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  }, []);

  // 絵文字選択
  const handleEmojiSelect = useCallback((emoji: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || message.length;
    const newMessage = message.slice(0, cursorPosition) + emoji + message.slice(cursorPosition);
    setMessage(newMessage);

    // カーソル位置を絵文字の後に設定
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPosition = cursorPosition + emoji.length;
        textareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
        textareaRef.current.focus();
      }
    }, 0);
  }, [message]);

  const canSend = (message.trim().length > 0 || attachments.length > 0) && !disabled && !isComposing;

  return (
    <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800" data-testid="message-input">
      <div className="p-4">
        {/* 添付ファイル表示エリア */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 text-sm"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-blue-700 dark:text-blue-300 truncate max-w-[150px]">
                  {attachment.name}
                </span>
                <button
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  title="添付ファイルを削除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* アップロードエラー表示 */}
        {uploadError && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-sm text-red-600 dark:text-red-400">
            {uploadError}
          </div>
        )}

        <div className="flex items-end space-x-3">
          {/* ファイル添付ボタン */}
          {allowFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <button
                type="button"
                onClick={handleAttachClick}
                disabled={disabled || isUploading}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="ファイルを添付"
              >
                {isUploading ? (
                  <div className="w-5 h-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                )}
              </button>
            </>
          )}

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
              data-testid="message-input-field"
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

            {/* 絵文字ピッカー */}
            {allowEmoji && (
              <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={() => setShowEmojiPicker(false)}
                onEmojiSelect={handleEmojiSelect}
                anchorRef={emojiButtonRef}
              />
            )}
          </div>

          {/* 絵文字ボタン */}
          {allowEmoji && (
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={disabled}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="絵文字を追加"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}

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