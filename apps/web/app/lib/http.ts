import { fetchWithCSRF } from './csrf';

type Json = Record<string, unknown> | unknown[];

function mergeHeaders(base: HeadersInit | undefined, extra: Record<string, string>): HeadersInit {
    // ベースヘッダーが存在しない場合は追加ヘッダーのみを返す
    if (!base) return extra;

    // Headers インスタンスの場合: 新しいインスタンスを作成して追加
    if (base instanceof Headers) {
        const h = new Headers(base);
        Object.entries(extra).forEach(([k, v]) => h.set(k, v));
        return h;
    }

    // 配列形式の場合: スプレッド演算子で結合
    if (Array.isArray(base)) {
        return [...base, ...Object.entries(extra)];
    }

    // オブジェクト形式の場合: オブジェクトをマージ
    return { ...base, ...extra } as Record<string, string>;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
    // Content-Typeヘッダーを確認してJSONかどうかを判定
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    try {
        // JSONパースを試行、失敗時はnullを返す（安全なパース）
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

async function post(url: string, init: RequestInit & { json?: Json } = {}): Promise<Response> {
    // リクエスト設定からjsonオプションを分離
    const { json, headers, ...rest } = init;
    const hasJson = typeof json !== 'undefined';

    // JSONデータがある場合は適切なContent-TypeとAcceptヘッダーを設定
    const h = mergeHeaders(
        headers,
        hasJson ? { 'Content-Type': 'application/json', Accept: 'application/json' } : {}
    );

    // JSONデータがあればシリアライズ、なければ元のbodyを使用
    const body = hasJson ? JSON.stringify(json) : init.body;

    // CSRF保護付きでPOSTリクエストを送信
    return fetchWithCSRF(url, { method: 'POST', headers: h, body, ...rest });
}

async function postJSON<T>(url: string, json: Json, init?: Omit<RequestInit, 'method' | 'body' | 'headers'>): Promise<T> {
    // POSTリクエストを送信してレスポンスを取得
    const res = await post(url, { json, ...(init || {}) });

    // エラーレスポンスの処理
    if (!res.ok) {
        // エラーメッセージをレスポンスから抽出
        const data = await parseJsonSafe<{ message?: string }>(res);
        const msg = data?.message || res.statusText || `HTTP ${res.status}`;
        // ステータスコード付きのエラーオブジェクトを生成
        throw Object.assign(new Error(msg), { status: res.status });
    }

    // 成功レスポンスのJSONパース
    const data = await parseJsonSafe<T>(res);
    if (data == null) {
        throw new Error('Expected JSON response');
    }
    return data;
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, credentials: 'include' });
    if (!res.ok) {
        const data = await parseJsonSafe<{ message?: string }>(res);
        const msg = data?.message || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return (await res.json()) as T;
}

export const http = {
    post,
    postJSON,
    getJSON,
};

export default http;


