import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileUpload } from '../useFileUpload';

// fetch をモック
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ファイルモックを作成するヘルパー
const createMockFile = (name: string, size: number, type: string): File => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('useFileUpload', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  describe('ファイルバリデーション', () => {
    test('有効なファイルはバリデーションを通過する', () => {
      const { result } = renderHook(() => useFileUpload());
      const validFile = createMockFile('test.jpg', 1024 * 1024, 'image/jpeg'); // 1MB

      const error = result.current.validateFile(validFile);
      expect(error).toBeNull();
    });

    test('ファイルサイズが制限を超える場合はエラーを返す', () => {
      const { result } = renderHook(() => useFileUpload({ maxSize: 1024 * 1024 })); // 1MB制限
      const largeFile = createMockFile('large.jpg', 2 * 1024 * 1024, 'image/jpeg'); // 2MB

      const error = result.current.validateFile(largeFile);
      expect(error).toContain('ファイルサイズが制限を超えています');
    });

    test('サポートされていないファイル形式の場合はエラーを返す', () => {
      const { result } = renderHook(() => useFileUpload({
        allowedTypes: ['image/jpeg', 'image/png']
      }));
      const unsupportedFile = createMockFile('test.exe', 1024, 'application/exe');

      const error = result.current.validateFile(unsupportedFile);
      expect(error).toContain('サポートされていないファイル形式です');
    });
  });

  describe('ファイルアップロード', () => {
    test('成功時は正しいUploadedFileオブジェクトを返す', async () => {
      const mockResponse = {
        file_id: 'test-id-123',
        file_url: 'https://example.com/test.jpg'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useFileUpload({ onSuccess }));

      const file = createMockFile('test.jpg', 1024, 'image/jpeg');

      let uploadResult: import('../useFileUpload').UploadedFile | null;
      await act(async () => {
        uploadResult = await result.current.uploadFile(file);
      });

      expect(uploadResult).toEqual({
        id: 'test-id-123',
        url: 'https://example.com/test.jpg',
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg'
      });

      expect(onSuccess).toHaveBeenCalledWith(
        'https://example.com/test.jpg',
        'test.jpg'
      );

      // fetch が正しいパラメータで呼ばれることを確認
      expect(mockFetch).toHaveBeenCalledWith('/api/backend/files/upload', {
        method: 'POST',
        body: expect.any(FormData),
        credentials: 'include'
      });
    });

    test('アップロード中の状態管理が正しく動作する', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ file_id: 'test-id', file_url: 'https://example.com/test.jpg' })
        }), 100))
      );

      const { result } = renderHook(() => useFileUpload());
      const file = createMockFile('test.jpg', 1024, 'image/jpeg');

      expect(result.current.isUploading).toBe(false);

      act(() => {
        result.current.uploadFile(file);
      });

      expect(result.current.isUploading).toBe(true);

      await waitFor(() => {
        expect(result.current.isUploading).toBe(false);
      });
    });

    test('ネットワークエラー時はエラーを適切に処理する', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const onError = jest.fn();
      const { result } = renderHook(() => useFileUpload({ onError }));

      const file = createMockFile('test.jpg', 1024, 'image/jpeg');

      let uploadResult: import('../useFileUpload').UploadedFile | null;
      await act(async () => {
        uploadResult = await result.current.uploadFile(file);
      });

      expect(uploadResult).toBeNull();
      expect(result.current.error).toContain('アップロードに失敗しました');
      expect(onError).toHaveBeenCalled();
    });

    test('バリデーションエラー時はアップロードを実行しない', async () => {
      const { result } = renderHook(() => useFileUpload({ maxSize: 1024 }));
      const largeFile = createMockFile('large.jpg', 2048, 'image/jpeg');

      let uploadResult: import('../useFileUpload').UploadedFile | null;
      await act(async () => {
        uploadResult = await result.current.uploadFile(largeFile);
      });

      expect(uploadResult).toBeNull();
      expect(result.current.error).toContain('ファイルサイズが制限を超えています');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('複数ファイルアップロード', () => {
    test('複数ファイルを順次アップロードする', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ file_id: 'id1', file_url: 'url1' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ file_id: 'id2', file_url: 'url2' })
        });

      const onProgress = jest.fn();
      const { result } = renderHook(() => useFileUpload({ onProgress }));

      const files = [
        createMockFile('test1.jpg', 1024, 'image/jpeg'),
        createMockFile('test2.jpg', 1024, 'image/jpeg')
      ];

      let uploadResults: import('../useFileUpload').UploadedFile[];
      await act(async () => {
        uploadResults = await result.current.uploadMultipleFiles(files);
      });

      expect(uploadResults).toHaveLength(2);
      expect(uploadResults[0].id).toBe('id1');
      expect(uploadResults[1].id).toBe('id2');

      // 進捗が更新されることを確認
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    test('一部のファイルでエラーが発生しても続行する', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ file_id: 'id1', file_url: 'url1' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400
        });

      const { result } = renderHook(() => useFileUpload());

      const files = [
        createMockFile('test1.jpg', 1024, 'image/jpeg'),
        createMockFile('test2.jpg', 1024, 'image/jpeg')
      ];

      let uploadResults: import('../useFileUpload').UploadedFile[];
      await act(async () => {
        uploadResults = await result.current.uploadMultipleFiles(files);
      });

      // 成功したファイルのみ結果に含まれる
      expect(uploadResults).toHaveLength(1);
      expect(uploadResults[0].id).toBe('id1');
    });
  });

  describe('状態リセット', () => {
    test('resetState でエラーと進捗がクリアされる', () => {
      const { result } = renderHook(() => useFileUpload());

      // エラー状態を設定
      act(() => {
        result.current.uploadFile(createMockFile('large.jpg', 999999999, 'image/jpeg'));
      });

      expect(result.current.error).toBeTruthy();

      // リセット実行
      act(() => {
        result.current.resetState();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.uploadProgress).toBe(0);
      expect(result.current.isUploading).toBe(false);
    });
  });

  describe('ヘルパー関数', () => {
    test('formatFileSize が正しいフォーマットを返す', () => {
      const { formatFileSize } = jest.requireActual('../useFileUpload') as typeof import('../useFileUpload');

      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    test('isImageFile が正しく画像ファイルを判定する', () => {
      const { isImageFile } = jest.requireActual('../useFileUpload') as typeof import('../useFileUpload');

      expect(isImageFile('image/jpeg')).toBe(true);
      expect(isImageFile('image/png')).toBe(true);
      expect(isImageFile('application/pdf')).toBe(false);
      expect(isImageFile('text/plain')).toBe(false);
    });
  });
});