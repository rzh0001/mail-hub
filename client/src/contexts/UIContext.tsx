import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

// --- 确认框 ---
interface ConfirmOptions {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

// --- Toast ---
type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

// --- Context ---
interface UIContextType {
  confirm: (message: string) => Promise<boolean>;
  toast: (message: string, type?: ToastType) => void;
}

const UIContext = createContext<UIContextType>(null!);

// --- Provider ---
export function UIProvider({ children }: { children: ReactNode }) {
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const resolveRef = useRef<(v: boolean) => void>(null!);
  const toastId = useRef(0);

  // confirm
  const confirm = useCallback((message: string): Promise<boolean> => {
    setConfirmOpts({ message });
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleConfirm = useCallback((result: boolean) => {
    setConfirmOpts(null);
    resolveRef.current?.(result);
  }, []);

  // toast
  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  return (
    <UIContext.Provider value={{ confirm, toast }}>
      {children}

      {/* 全局确认框 */}
      {confirmOpts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => handleConfirm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            {/* 图标 */}
            <div className={`w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center ${
              confirmOpts.danger ? 'bg-red-100' : 'bg-blue-100'
            }`}>
              <svg className={`w-6 h-6 ${confirmOpts.danger ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {confirmOpts.danger ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </div>
            {/* 标题 */}
            <h3 className="text-lg font-semibold text-gray-800 text-center mb-2">
              {confirmOpts.title || (confirmOpts.danger ? '确认操作' : '提示')}
            </h3>
            {/* 消息 */}
            <p className="text-sm text-gray-600 text-center mb-6">{confirmOpts.message}</p>
            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => handleConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                {confirmOpts.cancelText || '取消'}
              </button>
              <button
                onClick={() => handleConfirm(true)}
                className={`flex-1 px-4 py-2.5 text-white rounded-xl transition-colors text-sm font-medium ${
                  confirmOpts.danger
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmOpts.confirmText || (confirmOpts.danger ? '删除' : '确定')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全局 Toast */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none items-center">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all animate-slide-in ${
              t.type === 'success' ? 'bg-green-600 text-white' :
              t.type === 'error' ? 'bg-red-500 text-white' :
              'bg-gray-800 text-white'
            }`}
          >
            {/* 图标 */}
            {t.type === 'success' && (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {t.type === 'error' && (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {t.type === 'info' && (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {t.message}
            {/* 关闭按钮 */}
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

// --- Hook ---
export function useUI() {
  return useContext(UIContext);
}
