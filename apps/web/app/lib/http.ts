import { fetchWithCSRF } from './csrf';

type Json = Record<string, unknown> | unknown[];

function mergeHeaders(base: HeadersInit | undefined, extra: Record<string, string>): HeadersInit {
    if (!base) return extra;
    if (base instanceof Headers) {
        const h = new Headers(base);
        Object.entries(extra).forEach(([k, v]) => h.set(k, v));
        return h;
    }
    if (Array.isArray(base)) {
        return [...base, ...Object.entries(extra)];
    }
    return { ...base, ...extra } as Record<string, string>;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    try {
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

async function post(url: string, init: RequestInit & { json?: Json } = {}): Promise<Response> {
    const { json, headers, ...rest } = init;
    const hasJson = typeof json !== 'undefined';
    const h = mergeHeaders(
        headers,
        hasJson ? { 'Content-Type': 'application/json', Accept: 'application/json' } : {}
    );
    const body = hasJson ? JSON.stringify(json) : init.body;
    return fetchWithCSRF(url, { method: 'POST', headers: h, body, ...rest });
}

async function postJSON<T>(url: string, json: Json, init?: Omit<RequestInit, 'method' | 'body' | 'headers'>): Promise<T> {
    const res = await post(url, { json, ...(init || {}) });
    if (!res.ok) {
        const data = await parseJsonSafe<{ message?: string }>(res);
        const msg = data?.message || res.statusText || `HTTP ${res.status}`;
        throw Object.assign(new Error(msg), { status: res.status });
    }
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


