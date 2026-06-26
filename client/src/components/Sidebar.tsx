import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { MailAccount } from '../types';
import { getAccounts } from '../services/api';

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {});
  }, [location.pathname]);

  const navLinks = [
    { path: '/inbox', label: '邮件列表', icon: MailIcon },
    { path: '/accounts', label: '邮箱管理', icon: SettingsIcon },
    { path: '/settings', label: '系统设置', icon: GearIcon },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="h-full flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-800">MailHub</span>
        </Link>
      </div>

      {/* 写邮件按钮 */}
      <div className="px-3 pt-4">
        <Link
          to="/compose"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          写邮件
        </Link>
      </div>

      {/* 导航 */}
      <nav className="px-3 pt-4 flex-1">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-2">
          导航
        </div>
        {navLinks.map(link => (
          <Link
            key={link.path}
            to={link.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors mb-0.5 ${
              isActive(link.path)
                ? 'bg-blue-50 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <link.icon className="w-5 h-5" />
            {link.label}
          </Link>
        ))}

        {/* 邮箱账户列表 */}
        {accounts.length > 0 && (
          <div className="mt-6">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-2 mb-2">
              我的邮箱
            </div>
              {accounts.map(account => (
                <Link
                  key={account.id}
                  to={`/inbox?accountId=${account.id}`}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                    isActive('/inbox') && location.search.includes(account.id)
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: account.avatarColor || '#3B82F6' }}>
                    {account.avatarName || account.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{account.name}</span>
                </Link>
              ))}
          </div>
        )}
      </nav>

      {/* 底部版本 */}
      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-400">MailHub v1.0</p>
      </div>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
