import { useCallback, useEffect, useState, type RefCallback } from 'react';

interface Args {
  threshold?: number;
  root?: Element | null;
  rootMargin?: string;
}

export function useIntersectionObserver(options?: Args): [RefCallback<HTMLDivElement>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const threshold = options?.threshold;
  const root = options?.root;
  const rootMargin = options?.rootMargin;
  const ref = useCallback<RefCallback<HTMLDivElement>>((node) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (!element) {
      setIsIntersecting(false);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, { threshold, root, rootMargin });

    observer.observe(element);
    return () => observer.disconnect();
  }, [element, threshold, root, rootMargin]);

  return [ref, isIntersecting];
}
