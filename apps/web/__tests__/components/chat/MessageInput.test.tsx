import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MessageInput } from '../../../app/components/chat/MessageInput';

describe('MessageInput', () => {
  const mockOnSendMessage = jest.fn();

  beforeEach(() => {
    mockOnSendMessage.mockClear();
  });

  test('基本的なメッセージ入力と送信', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    const sendButton = screen.getByRole('button', { name: '' }); // SVGアイコンなので名前なし
    
    // メッセージを入力
    await user.type(textarea, 'テストメッセージ');
    expect(textarea).toHaveValue('テストメッセージ');
    
    // 送信ボタンがアクティブになることを確認
    expect(sendButton).not.toBeDisabled();
    
    // 送信
    await user.click(sendButton);
    expect(mockOnSendMessage).toHaveBeenCalledWith('テストメッセージ');
    expect(textarea).toHaveValue(''); // 送信後にクリアされる
  });

  test('Enterキーでメッセージ送信', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    
    await user.type(textarea, 'Enterで送信');
    await user.keyboard('{Enter}');
    
    expect(mockOnSendMessage).toHaveBeenCalledWith('Enterで送信');
    expect(textarea).toHaveValue('');
  });

  test('Shift+Enterで改行', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    
    await user.type(textarea, '1行目');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, '2行目');
    
    expect(textarea).toHaveValue('1行目\n2行目');
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  test('空のメッセージは送信されない', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    // 送信ボタンをより具体的に選択
    const buttons = screen.getAllByRole('button');
    const sendButton = buttons.find(button => !button.title); // 送信ボタンはtitleなし
    expect(sendButton).toBeDefined();
    
    // 空の状態では送信ボタンが無効
    expect(sendButton).toBeDisabled();
    
    // スペースのみのメッセージ
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    await user.type(textarea, '   ');
    
    expect(sendButton).toBeDisabled();
    
    // Enterキーを押しても送信されない
    await user.keyboard('{Enter}');
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  test('文字数制限の表示', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} maxLength={100} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    
    // 80文字以上入力すると文字数カウンターが表示される
    const longMessage = 'a'.repeat(85);
    await user.type(textarea, longMessage);
    
    expect(screen.getByText('85/100')).toBeInTheDocument();
    
    // 上限に達すると赤色になる
    const maxMessage = 'a'.repeat(100);
    await user.clear(textarea);
    await user.type(textarea, maxMessage);
    
    const counter = screen.getByText('100/100');
    expect(counter).toHaveClass('text-red-500');
  });

  test('文字数制限を超えた入力は制限される', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} maxLength={10} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    
    // 制限を超えた文字数を入力
    await user.type(textarea, '12345678901234567890');
    
    // 10文字までしか入力されない
    expect(textarea).toHaveValue('1234567890');
  });

  test('disabled状態', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} disabled={true} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    const buttons = screen.getAllByRole('button');
    const sendButton = buttons.find(button => !button.title);
    
    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
    
    // 入力できない
    await user.type(textarea, 'テスト');
    expect(textarea).toHaveValue('');
  });

  test('カスタムプレースホルダー', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} placeholder="カスタムメッセージ..." />);
    
    expect(screen.getByPlaceholderText('カスタムメッセージ...')).toBeInTheDocument();
  });

  test('IME入力中はEnterで送信しない', async () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    
    // IME入力開始をシミュレート
    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: 'テスト' } });
    
    // IME入力中にEnterを押しても送信されない
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(mockOnSendMessage).not.toHaveBeenCalled();
    
    // IME入力終了後はEnterで送信される
    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(mockOnSendMessage).toHaveBeenCalledWith('テスト');
  });

  test('テキストエリアの高さ自動調整', async () => {
    const user = userEvent.setup();
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const textarea = screen.getByPlaceholderText('メッセージを入力してください...');
    
    // 初期の高さを確認
    expect(textarea).toHaveStyle('min-height: 44px');
    
    // 長いテキストを入力
    const longText = 'これは長いメッセージです。\n'.repeat(5);
    await user.type(textarea, longText);
    
    // heightプロパティが設定されることを確認
    expect(textarea.style.height).toBeTruthy();
  });

  test('ショートカットヒントの表示', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    expect(screen.getByText('Enter: 送信')).toBeInTheDocument();
    expect(screen.getByText('Shift + Enter: 改行')).toBeInTheDocument();
  });

  test('添付ファイルボタンが無効状態で表示', () => {
    render(<MessageInput onSendMessage={mockOnSendMessage} />);
    
    const attachButton = screen.getByTitle('ファイルを添付（近日公開）');
    expect(attachButton).toBeDisabled();
  });
});