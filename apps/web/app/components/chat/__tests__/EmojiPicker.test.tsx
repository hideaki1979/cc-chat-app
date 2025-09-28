import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiPicker } from '../EmojiPicker';

describe('EmojiPicker', () => {
  const defaultProps = {
    onEmojiSelect: jest.fn(),
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('表示・非表示', () => {
    test('isOpen=true の時にピッカーが表示される', () => {
      render(<EmojiPicker {...defaultProps} isOpen={true} />);

      expect(screen.getByPlaceholderText('絵文字を検索...')).toBeInTheDocument();
      expect(screen.getByText('絵文字をクリックして選択')).toBeInTheDocument();
    });

    test('isOpen=false の時にピッカーが表示されない', () => {
      render(<EmojiPicker {...defaultProps} isOpen={false} />);

      expect(screen.queryByPlaceholderText('絵文字を検索...')).not.toBeInTheDocument();
    });
  });

  describe('カテゴリ表示', () => {
    test('デフォルトで笑顔カテゴリが選択されている', () => {
      render(<EmojiPicker {...defaultProps} />);

      // 笑顔カテゴリの絵文字が表示されていることを確認
      expect(screen.getByText('😀')).toBeInTheDocument();
      expect(screen.getByText('😃')).toBeInTheDocument();
      expect(screen.getByText('😄')).toBeInTheDocument();
    });

    test('カテゴリタブをクリックすると対応する絵文字が表示される', async () => {
      const user = userEvent.setup();
      render(<EmojiPicker {...defaultProps} />);

      // ハートカテゴリのタブを探してクリック（最初の絵文字で識別）
      const heartTabButton = screen.getByTitle('❤️ ハート');
      await user.click(heartTabButton);

      // ハートカテゴリの絵文字が表示されることを確認
      expect(screen.getByText('❤️')).toBeInTheDocument();
      expect(screen.getByText('🧡')).toBeInTheDocument();
      expect(screen.getByText('💛')).toBeInTheDocument();
    });

    test('動物カテゴリが正しく表示される', async () => {
      const user = userEvent.setup();
      render(<EmojiPicker {...defaultProps} />);

      const animalTabButton = screen.getByTitle('🐶 動物');
      await user.click(animalTabButton);

      expect(screen.getByText('🐶')).toBeInTheDocument();
      expect(screen.getByText('🐱')).toBeInTheDocument();
      expect(screen.getByText('🐭')).toBeInTheDocument();
    });
  });

  describe('絵文字選択', () => {
    test('絵文字をクリックすると onEmojiSelect が呼ばれる', async () => {
      const user = userEvent.setup();
      const onEmojiSelect = jest.fn();

      render(<EmojiPicker {...defaultProps} onEmojiSelect={onEmojiSelect} />);

      const emojiButton = screen.getByText('😀');
      await user.click(emojiButton);

      expect(onEmojiSelect).toHaveBeenCalledWith('😀');
    });

    test('絵文字選択後に onClose が呼ばれる', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();

      render(<EmojiPicker {...defaultProps} onClose={onClose} />);

      const emojiButton = screen.getByText('😀');
      await user.click(emojiButton);

      expect(onClose).toHaveBeenCalled();
    });

    test('異なる絵文字を選択すると正しい絵文字が渡される', async () => {
      const user = userEvent.setup();
      const onEmojiSelect = jest.fn();

      render(<EmojiPicker {...defaultProps} onEmojiSelect={onEmojiSelect} />);

      await user.click(screen.getByText('😃'));
      expect(onEmojiSelect).toHaveBeenCalledWith('😃');

      await user.click(screen.getByText('😄'));
      expect(onEmojiSelect).toHaveBeenCalledWith('😄');
    });
  });

  describe('検索機能', () => {
    test('検索ボックスに入力すると対応する絵文字が表示される', async () => {
      const user = userEvent.setup();
      render(<EmojiPicker {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('絵文字を検索...');
      await user.type(searchInput, '😀');

      // 検索結果が表示される
      expect(screen.getByText('"😀" の検索結果')).toBeInTheDocument();
      expect(screen.getByText('😀')).toBeInTheDocument();
    });

    test('検索中はカテゴリタブが非表示になる', async () => {
      const user = userEvent.setup();
      render(<EmojiPicker {...defaultProps} />);

      // 初期状態ではカテゴリタブが表示されている
      expect(screen.getByTitle('😀 顔・感情')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('絵文字を検索...');
      await user.type(searchInput, '😀');

      // 検索中はカテゴリタブが非表示
      expect(screen.queryByTitle('😀 顔・感情')).not.toBeInTheDocument();
    });

    test('検索結果がない場合は適切なメッセージが表示される', async () => {
      const user = userEvent.setup();
      render(<EmojiPicker {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('絵文字を検索...');
      await user.type(searchInput, 'xyz123');

      expect(screen.getByText('絵文字が見つかりませんでした')).toBeInTheDocument();
    });

    test('検索ボックスをクリアするとカテゴリ表示に戻る', async () => {
      const user = userEvent.setup();
      render(<EmojiPicker {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('絵文字を検索...');

      // 検索
      await user.type(searchInput, '😀');
      expect(screen.getByText('"😀" の検索結果')).toBeInTheDocument();

      // クリア
      await user.clear(searchInput);

      // カテゴリ表示に戻る
      expect(screen.getByTitle('😀 顔・感情')).toBeInTheDocument();
      expect(screen.queryByText('"😀" の検索結果')).not.toBeInTheDocument();
    });
  });

  describe('キーボードイベント', () => {
    test('ESCキーで onClose が呼ばれる', () => {
      const onClose = jest.fn();
      render(<EmojiPicker {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });

    test('isOpen=false の時はESCキーで onClose が呼ばれない', () => {
      const onClose = jest.fn();
      render(<EmojiPicker {...defaultProps} isOpen={false} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('クリック外側検出', () => {
    test('ピッカー外をクリックすると onClose が呼ばれる', async () => {
      const onClose = jest.fn();
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <EmojiPicker {...defaultProps} onClose={onClose} />
        </div>
      );

      const outsideElement = screen.getByTestId('outside');
      fireEvent.mouseDown(outsideElement);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    test('ピッカー内をクリックしても onClose は呼ばれない', async () => {
      const onClose = jest.fn();
      render(<EmojiPicker {...defaultProps} onClose={onClose} />);

      const searchInput = screen.getByPlaceholderText('絵文字を検索...');
      fireEvent.mouseDown(searchInput);

      // 少し待機してもonCloseが呼ばれないことを確認
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('アクセシビリティ', () => {
    test('絵文字ボタンに適切なtitle属性が設定されている', () => {
      render(<EmojiPicker {...defaultProps} />);

      // getAllByTextで複数の要素を取得し、最初の要素をテスト
      const emojiButtons = screen.getAllByText('😀');
      expect(emojiButtons[0]).toHaveAttribute('title', '😀');
    });

    test('カテゴリタブに適切なtitle属性が設定されている', () => {
      render(<EmojiPicker {...defaultProps} />);

      expect(screen.getByTitle('😀 顔・感情')).toBeInTheDocument();
      expect(screen.getByTitle('👋 ジェスチャー')).toBeInTheDocument();
      expect(screen.getByTitle('❤️ ハート')).toBeInTheDocument();
    });

    test('検索入力フィールドに適切なplaceholder が設定されている', () => {
      render(<EmojiPicker {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('絵文字を検索...');
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('anchorRef との連携', () => {
    test('anchorRef要素をクリックしても onClose は呼ばれない', async () => {
      const anchorRef = React.useRef<HTMLButtonElement | null>(null);
      const onClose = jest.fn();

      render(
        <div>
          <button ref={anchorRef} data-testid="anchor">Anchor</button>
          <EmojiPicker {...defaultProps} onClose={onClose} anchorRef={anchorRef} />
        </div>
      );

      const anchorElement = screen.getByTestId('anchor');
      fireEvent.mouseDown(anchorElement);

      // 少し待機してもonCloseが呼ばれないことを確認
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});