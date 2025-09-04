'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/auth';

export function AuthInit() {
    const { isInitialized, initializeAuth } = useAuthStore();
    const didRunRef = useRef(false);

    useEffect(() => {
        if (didRunRef.current) return;
        didRunRef.current = true;
        if (!isInitialized) {
            void initializeAuth();
        }
    }, [isInitialized, initializeAuth]);

    return null;
}


