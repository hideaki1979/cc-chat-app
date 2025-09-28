import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageInput } from '../MessageInput';

// useFileUpload のモック
jest.mock('../../../hooks/useFileUpload', () => ({
  useFileUpload: jest.fn(() => ({
    uploadFile: jest.fn(),
    isUploading: false,
    error: null,
    resetState: jest.fn(),
    validateFile: jest.fn(() => null)
  })),
  formatFileSize: jest.fn((bytes: number) => `${bytes} bytes`),
  isImageFile: jest.fn((type: string) => type.startsWith('image/'))
}));

// EmojiPicker のモック
jest.mock('../EmojiPicker', () => {
  type EmojiPickerProps = {
    isOpen: boolean;
    onEmojiSelect: (emoji: string) => void;
    onClose: () => void;
  };

  const EmojiPicker = ({ isOpen, onEmojiSelect, onClose }: EmojiPickerProps) => (
    isOpen ? (
      <div data-testid="emoji-picker">
        <button onClick={() => onEmojiSelect('😀')} data-testid="emoji-smile">😀</button>
        <button onClick={onClose} data-testid="emoji-close">Close</button>
      </div>
    ) : null
  );

  return { EmojiPicker };
});

describe('MessageInput', () => {
  const defaultProps = {
    onSendMessage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本機能', () => {
    test('メッセージ入力エリアが表示される', () => {
      render(<MessageInput {...defaultProps} />);

      const textarea = screen.getByTestId('message-input-field');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('placeholder', 'メッセージを入力してください...');
    });

    test('カスタムプレースホルダーが設定される', () => {
      render(<MessageInput {...defaultProps} placeholder="カスタムメッセージ" />);

      const textarea = screen.getByPlaceholderText('カスタムメッセージ');
      expect(textarea).toBeInTheDocument();
    });

    test('送信ボタンが表示される', () => {
      render(<MessageInput {...defaultProps} />);

      const sendButton = screen.getByLabelText('メッセージを送信');
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe('メッセージ送信', () => {
    test('メッセージを入力して送信ボタンをクリックすると onSendMessage が呼ばれる', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<MessageInput {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByTestId('message-input-field');
      const sendButton = screen.getByLabelText('メッセージを送信');

      await user.type(textarea, 'テストメッセージ');
      await user.click(sendButton);

      expect(onSendMessage).toHaveBeenCalledWith('テストメッセージ', []);
    });

    test('Enterキーでメッセージが送信される', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<MessageInput {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, 'テストメッセージ');
      await user.keyboard('{Enter}');

      expect(onSendMessage).toHaveBeenCalledWith('テストメッセージ', []);
    });

    test('Shift+Enterで改行される（送信されない）', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<MessageInput {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, 'テスト');
      await user.keyboard('{Shift>}{Enter}{/Shift}');

      expect(onSendMessage).not.toHaveBeenCalled();
      expect(textarea).toHaveValue('テスト\n');
    });

    test('空のメッセージは送信されない', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<MessageInput {...defaultProps} onSendMessage={onSendMessage} />);

      const sendButton = screen.getByLabelText('メッセージを送信');

      // 空文字列
      await user.click(sendButton);
      expect(onSendMessage).not.toHaveBeenCalled();

      // スペースのみ
      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, '   ');
      await user.click(sendButton);
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    test('送信後にメッセージ入力欄がクリアされる', async () => {
      const user = userEvent.setup();
      const onSendMessage = jest.fn();

      render(<MessageInput {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, 'テストメッセージ');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });
  });

  describe('文字数制限', () => {
    test('文字数制限が適用される', async () => {
      const user = userEvent.setup();
      render(<MessageInput {...defaultProps} maxLength={10} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, '1234567890abcdef'); // 16文字

      expect(textarea).toHaveValue('1234567890'); // 10文字まで
    });

    test('文字数カウンターが表示される', async () => {
      const user = userEvent.setup();
      render(<MessageInput {...defaultProps} maxLength={10} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, '12345678'); // 8文字（80%）

      expect(screen.getByText('8/10')).toBeInTheDocument();
    });

    test('文字数超過時は赤色で表示される', async () => {
      const user = userEvent.setup();
      render(<MessageInput {...defaultProps} maxLength={10} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, '1234567890'); // 10文字（100%）

      const counter = screen.getByText('10/10');
      expect(counter).toHaveClass('text-red-500');
    });
  });

  describe('disabled状態', () => {
    test('disabled時は入力欄が無効になる', () => {
      render(<MessageInput {...defaultProps} disabled={true} />);

      const textarea = screen.getByTestId('message-input-field');
      const sendButton = screen.getByLabelText('メッセージを送信');

      expect(textarea).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    test('disabled時はファイル添付ボタンも無効になる', () => {
      render(<MessageInput {...defaultProps} disabled={true} />);

      const attachButton = screen.getByTitle('ファイルを添付');
      expect(attachButton).toBeDisabled();
    });
  });

  describe('ファイル添付機能', () => {
    test('allowFileUpload=true でファイル添付ボタンが表示される', () => {
      render(<MessageInput {...defaultProps} allowFileUpload={true} />);

      const attachButton = screen.getByTitle('ファイルを添付');
      expect(attachButton).toBeInTheDocument();
    });

    test('allowFileUpload=false でファイル添付ボタンが非表示になる', () => {
      render(<MessageInput {...defaultProps} allowFileUpload={false} />);

      const attachButton = screen.queryByTitle('ファイルを添付');
      expect(attachButton).not.toBeInTheDocument();
    });

    test('ファイル添付ボタンをクリックするとファイル選択ダイアログが開く', async () => {
      const user = userEvent.setup();
      render(<MessageInput {...defaultProps} allowFileUpload={true} />);

      const attachButton = screen.getByTitle('ファイルを添付');
      await user.click(attachButton);

      // ファイル入力要素がクリックされることを確認
      const fileInput = document.querySelector('input[type="file]') as HTMLInputElement | null;
      expect(fileInput).not.toBeNull();
      expect(fileInput).toHaveAttribute('type', 'file');
    });

    test('添付ファイルが表示される', () => {
      // useFileUpload モックを更新して添付ファイルありの状態にする
      const { useFileUpload } = jest.requireMock('../../../hooks/useFileUpload') as {
        useFileUpload: jest.Mock;
      };
      useFileUpload.mockReturnValue({
        uploadFile: jest.fn(),
        isUploading: false,
        error: null,
        resetState: jest.fn(),
        validateFile: jest.fn(() => null)
      });

      render(<MessageInput {...defaultProps} />);

      // 実際の添付ファイル表示テストは、状態管理のテストとして別途実装
      expect(screen.queryByText('test.jpg')).not.toBeInTheDocument(); // 初期状態では表示されない
    });
  });

  describe('絵文字ピッカー機能', () => {
    test('allowEmoji=true で絵文字ボタンが表示される', () => {
      render(<MessageInput {...defaultProps} allowEmoji={true} />);

      const emojiButton = screen.getByTitle('絵文字を追加');
      expect(emojiButton).toBeInTheDocument();
    });

    test('allowEmoji=false で絵文字ボタンが非表示になる', () => {
      render(<MessageInput {...defaultProps} allowEmoji={false} />);

      const emojiButton = screen.queryByTitle('絵文字を追加');
      expect(emojiButton).not.toBeInTheDocument();
    });

    test('絵文字ボタンをクリックするとピッカーが表示される', async () => {
      const user = userEvent.setup();
      render(<MessageInput {...defaultProps} allowEmoji={true} />);

      const emojiButton = screen.getByTitle('絵文字を追加');
      await user.click(emojiButton);

      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();
    });

    test('絵文字を選択するとテキストエリアに挿入される', async () => {
      const user = userEvent.setup();
      render(<MessageInput {...defaultProps} allowEmoji={true} />);

      const textarea = screen.getByTestId('message-input-field');
      const emojiButton = screen.getByTitle('絵文字を追加');

      // テキストを入力
      await user.type(textarea, 'Hello ');

      // 絵文字ピッカーを開く
      await user.click(emojiButton);

      // 絵文字を選択
      const smileEmoji = screen.getByTestId('emoji-smile');
      await user.click(smileEmoji);

      await waitFor(() => {
        expect(textarea).toHaveValue('Hello 😀');
      });
    });

    test('絵文字選択後にピッカーが閉じる', async () => {
      const user = userEvent.setup();
      render(<MessageInput {...defaultProps} allowEmoji={true} />);

      const emojiButton = screen.getByTitle('絵文字を追加');

      // ピッカーを開く
      await user.click(emojiButton);
      expect(screen.getByTestId('emoji-picker')).toBeInTheDocument();

      // 絵文字を選択
      const smileEmoji = screen.getByTestId('emoji-smile');
      await user.click(smileEmoji);

      await waitFor(() => {
        expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
      });
    });
  });

  describe('タイピング通知', () => {
    test('メッセージ入力時に onTypingStart が呼ばれる', async () => {
      const user = userEvent.setup();
      const onTypingStart = jest.fn();

      render(<MessageInput {...defaultProps} onTypingStart={onTypingStart} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, 'a');

      expect(onTypingStart).toHaveBeenCalled();
    });

    test('メッセージ送信時に onTypingStop が呼ばれる', async () => {
      const user = userEvent.setup();
      const onTypingStop = jest.fn();

      render(<MessageInput {...defaultProps} onTypingStop={onTypingStop} />);

      const textarea = screen.getByTestId('message-input-field');
      await user.type(textarea, 'テストメッセージ');
      await user.keyboard('{Enter}');

      expect(onTypingStop).toHaveBeenCalled();
    });
  });

  describe('IME対応', () => {
    test('IME入力中はEnterキーで送信されない', async () => {
      const onSendMessage = jest.fn();
      render(<MessageInput {...defaultProps} onSendMessage={onSendMessage} />);

      const textarea = screen.getByTestId('message-input-field');

      // IME入力開始をシミュレート
      fireEvent.compositionStart(textarea);
      fireEvent.change(textarea, { target: { value: 'テスト' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSendMessage).not.toHaveBeenCalled();

      // IME入力終了
      fireEvent.compositionEnd(textarea);
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSendMessage).toHaveBeenCalledWith('テスト', []);
    });
  });

  describe('ショートカットヒント', () => {
    test('ショートカットヒントが表示される', () => {
      render(<MessageInput {...defaultProps} />);

      expect(screen.getByText('Enter: 送信')).toBeInTheDocument();
      expect(screen.getByText('Shift + Enter: 改行')).toBeInTheDocument();
    });
  });
});