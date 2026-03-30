"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 要素がビューポートに入ったかを検知する。
 * 一度 true になったら解除する（地図は一度ロードすれば十分）。
 */
export function useInView(rootMargin = "200px"): {
  ref: React.RefObject<HTMLDivElement | null>;
  inView: boolean;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
