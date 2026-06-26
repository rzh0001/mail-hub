import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LockScreen() {
  const { isLocked, unlock } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLocked) {
      // 延迟聚焦，确保 DOM 已渲染
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (json.success) {
        setPassword('');
        unlock();
      } else {
        setError(json.error || '密码错误');
        setPassword('');
      }
    } catch {
      setError('验证失败，请重试');
      setPassword('');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        {/* Logo / 图标 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">MailHub</h1>
          <p className="text-sm text-gray-400 mt-1">邮箱聚合管理系统</p>
        </div>

        {/* 密码输入 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="请输入锁屏密码"
              disabled={loading}
              className={`w-full px-4 py-3.5 bg-white/10 border ${
                error ? 'border-red-400' : 'border-white/20'
              } rounded-xl text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all`}
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs mt-1.5 ml-1">{error}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium text-sm hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                验证中...
              </span>
            ) : '解锁'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-6">
          首次使用默认密码为 123456
        </p>
      </div>
    </div>
  );
}
