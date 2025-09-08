'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../stores/auth';

export function AuthInit() {
    const { isInitialized, initializeAuth } = useAuthStore();
    const didRunRef = useRef(false);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (didRunRef.current) return;
        didRunRef.current = true;
        if (!isInitialized) {
            // Next.jsのルーターを使用してリダイレクト処理を委譲（履歴を置き換え）
            const handleUnauthorized = (currentPath: string) => {
                const redirectParam = encodeURIComponent(currentPath);
                router.replace(`/login?redirect=${redirectParam}`);
            };

            void initializeAuth({ currentPath: pathname, onUnauthorized: handleUnauthorized });
        }
    }, [isInitialized, initializeAuth, pathname, router]);

    return null;
}


