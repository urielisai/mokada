import { useEffect, useState } from 'react';

type PresenceState = 'open' | 'closed';

/**
 * Keeps an overlay mounted long enough to play its exit transition.
 * `state` starts as "closed" for one frame after mounting so CSS
 * transitions keyed on [data-state] can run on enter as well as exit.
 */
export const usePresence = (isOpen: boolean, exitMs = 240) => {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [state, setState] = useState<PresenceState>('closed');

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setState('open'));
      });
      return () => cancelAnimationFrame(frame);
    }

    setState('closed');
    const timeout = window.setTimeout(() => setIsMounted(false), exitMs);
    return () => window.clearTimeout(timeout);
  }, [isOpen, exitMs]);

  return { isMounted, state };
};
