import { useLayoutEffect, useRef } from "react"

export const useAutoScroll = (dependency: unknown) => {
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        // DOM更新後に同期的にスクロール実行
        ref.current?.scrollIntoView({ behavior: 'smooth' });
    }, [dependency])
    return ref;
}
