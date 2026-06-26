import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { getSettings } from '../services/api';

interface AuthContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
  autoLockMinutes: number;
  setAutoLockMinutes: (minutes: number) => void;
  resetTimer: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(true); // 默认锁定
  const [autoLockMinutes, setAutoLockMinutesState] = useState(5);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  // 加载自动锁屏设置
  useEffect(() => {
    getSettings().then(s => {
      const val = parseInt(s.auto_lock_minutes || '5');
      setAutoLockMinutesState(val);
    }).catch(() => {});
  }, []);

  const lock = useCallback(() => {
    setIsLocked(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    startedRef.current = true;
  }, []);

  const setAutoLockMinutes = useCallback((minutes: number) => {
    setAutoLockMinutesState(minutes);
  }, []);

  const resetTimer = useCallback(() => {
    if (!startedRef.current || isLocked || autoLockMinutes <= 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, autoLockMinutes * 60 * 1000);
  }, [isLocked, autoLockMinutes]);

  // 自动锁屏设置变化时重置定时器
  useEffect(() => {
    if (!startedRef.current || isLocked) return;
    resetTimer();
  }, [autoLockMinutes, isLocked, resetTimer]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isLocked, lock, unlock, autoLockMinutes, setAutoLockMinutes, resetTimer }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
