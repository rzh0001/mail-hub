import { useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useActivityTimeout() {
  const { isLocked, resetTimer } = useAuth();

  const handleActivity = useCallback(() => {
    if (!isLocked) {
      resetTimer();
    }
  }, [isLocked, resetTimer]);

  useEffect(() => {
    if (isLocked) return;

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel', 'scroll'];
    for (const ev of events) {
      window.addEventListener(ev, handleActivity, { passive: true });
    }

    // 初始启动定时器
    resetTimer();

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, handleActivity);
      }
    };
  }, [isLocked, handleActivity, resetTimer]);

  return null;
}
