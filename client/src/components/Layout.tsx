import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import type { MailAccount } from '../types';
import { getAccounts } from '../services/api';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {});
  }, [location.pathname]);

  // 从 URL 同步搜索框内容
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q !== null && q !== searchValue) {
      setSearchValue(q);
    }
    if (q === null && searchValue !== '') {
      setSearchValue('');
    }
  }, [location.search]);

  // 路由切换时关闭所有下拉菜单
  useEffect(() => {
    setSettingsOpen(false);
    setAccountOpen(false);
  }, [location.pathname, location.search]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (val.trim()) {
        navigate(`/inbox?q=${encodeURIComponent(val.trim())}`);
      } else {
        navigate('/inbox');
      }
    }, 400);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (searchValue.trim()) {
        navigate(`/inbox?q=${encodeURIComponent(searchValue.trim())}`);
      }
    }
  };
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* ===== 顶部栏 ===== */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 z-40">
        {/* Logo */}
        <button onClick={() => navigate('/inbox')} className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-base font-bold text-gray-800 hidden sm:inline">Mail</span>
        </button>

        {/* 搜索框（靠左） */}
        <div className="w-full max-w-xs mr-auto relative ml-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="搜索邮件主题或发件人..."
            className="w-full pl-9 pr-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors placeholder-gray-400"
          />
        </div>

        {/* 右侧操作 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* ===== 账户选择下拉框 ===== */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setAccountOpen(!accountOpen); setSettingsOpen(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:inline max-w-[100px] truncate">{(() => {
                const ca = new URLSearchParams(location.search).get('accountId');
                if (!ca) return '切换账户';
                const cur = accounts.find(a => a.id === ca);
                return cur ? cur.name || cur.email : '切换账户';
              })()}</span>
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {accountOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[180px]">
                  <button
                    onClick={() => { setAccountOpen(false); navigate('/accounts'); }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    添加账户
                  </button>
                  <div className="h-px bg-gray-100 mx-2" />
                  {accounts.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">暂无账户</div>
                  ) : (
                    (() => {
                      const ca = new URLSearchParams(location.search).get('accountId');
                      return accounts.map(account => {
                        const active = account.id === ca;
                        return (
                          <button key={account.id}
                            onClick={() => { setAccountOpen(false); navigate(`/inbox?accountId=${account.id}`); }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                          >
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-semibold flex-shrink-0"
                              style={{ backgroundColor: account.avatarColor || '#3B82F6' }}>
                              {account.avatarName || account.email.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate flex-1">{account.name || account.email}</span>
                            {active && (
                              <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              </svg>
                            )}
                          </button>
                        );
                      });
                    })()
                  )}
                </div>
              </>
            )}
          </div>

          {/* ===== 设置下拉菜单 ===== */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setSettingsOpen(!settingsOpen); setAccountOpen(false); }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors text-sm ${
                location.pathname.startsWith('/settings')
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
              title="设置"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">设置</span>
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                  <button
                    onClick={() => { setSettingsOpen(false); navigate('/accounts'); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    账户设置
                  </button>
                  <button
                    onClick={() => { setSettingsOpen(false); navigate('/settings'); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    </svg>
                    系统设置
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 移动端菜单按钮 */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* ===== 主内容区 ===== */}
      <div className="flex-1 flex min-h-0">
        {/* 移动端遮罩 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* 移动端侧边栏（抽屉式） */}
        <div className={`fixed inset-y-0 left-0 z-30 w-52 bg-white border-r border-gray-200 pt-12 transform transition-transform duration-200 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </div>

        {/* 桌面端侧边栏（始终可见） */}
        <div className="hidden lg:block w-52 bg-white border-r border-gray-200 flex-shrink-0">
          <Sidebar onClose={() => {}} />
        </div>

        {/* 内容区 */}
        <main className="flex-1 min-w-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
