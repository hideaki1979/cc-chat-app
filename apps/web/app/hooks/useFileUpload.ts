'use client';

import { useState, useCallback } from 'react';

export interface FileUploadOptions {
  maxSize?: number; // bytes (default: 10MB)
  allowedTypes?: string[]; // MIME types
  onProgress?: (progress: number) => void;
  onSuccess?: (fileUrl: string, fileName: string) => void;
  onError?: (error: Error) => void;
}

export interface UploadedFile {
  id: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const useFileUpload = (options: FileUploadOptions = {}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const {
    maxSize = DEFAULT_MAX_SIZE,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    onProgress,
    onSuccess,
    onError,
  } = options;

  const validateFile = useCallback((file: File): string | null => {
    // ファイルサイズチェック
    if (file.size > maxSize) {
      return `ファイルサイズが制限を超えています。${Math.round(maxSize / 1024 / 1024)}MB以下のファイルを選択してください。`;
    }

    // ファイル形式チェック
    if (!allowedTypes.includes(file.type)) {
      return `サポートされていないファイル形式です。\n対応形式: ${allowedTypes.join(', ')}`;
    }

    return null;
  }, [maxSize, allowedTypes]);

  const uploadFile = useCallback(async (file: File): Promise<UploadedFile | null> => {
    setError(null);
    setUploadProgress(0);

    // ファイルバリデーション
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onError?.(new Error(validationError));
      return null;
    }

    setIsUploading(true);

    try {
      // FormDataでファイルを送信
      const formData = new FormData();
      formData.append('file', file);

      // プログレス付きでアップロード
      const response = await fetch('/api/backend/files/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`アップロードに失敗しました: ${response.status}`);
      }

      const result = await response.json();

      const uploadedFile: UploadedFile = {
        id: result.file_id,
        url: result.file_url,
        name: file.name,
        size: file.size,
        type: file.type,
      };

      setUploadProgress(100);
      onProgress?.(100);
      onSuccess?.(uploadedFile.url, uploadedFile.name);

      return uploadedFile;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'アップロードに失敗しました';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [validateFile, onProgress, onSuccess, onError]);

  const uploadMultipleFiles = useCallback(async (files: FileList | File[]): Promise<UploadedFile[]> => {
    const fileArray = Array.from(files);
    const results: UploadedFile[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      if (file) {
        const result = await uploadFile(file);
        if (result) {
          results.push(result);
        }
      }

      // 複数ファイルの場合の進捗更新
      if (fileArray.length > 1) {
        const overallProgress = ((i + 1) / fileArray.length) * 100;
        setUploadProgress(overallProgress);
        onProgress?.(overallProgress);
      }
    }

    return results;
  }, [uploadFile, onProgress]);

  const resetState = useCallback(() => {
    setError(null);
    setUploadProgress(0);
    setIsUploading(false);
  }, []);

  return {
    uploadFile,
    uploadMultipleFiles,
    isUploading,
    uploadProgress,
    error,
    resetState,
    validateFile,
  };
};

// ファイルサイズを人間が読みやすい形式に変換
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ファイルタイプがイメージかどうかチェック
export const isImageFile = (type: string): boolean => {
  return type.startsWith('image/');
};