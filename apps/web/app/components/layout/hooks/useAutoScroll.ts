import { useLayoutEffect, useRef } from "react"

export const useAutoScroll = (dependency: number) => {
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        // DOM更新後に同期的にスクロール実行
        ref.current?.scrollIntoView({behavior: 'smooth'});
    })
  return ref;
}
