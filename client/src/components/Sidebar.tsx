import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { MailAccount } from '../types';
import { getAccounts } from '../services/api';

interface SidebarProps {
  onClose: () => void;
}

const EMAIL_TYPE_MAP: Record<string, string> = {
  'qq.com': 'QQ',
  '163.com': '163',
  '126.com': '126',
  'gmail.com': 'Gmail',
  'outlook.com': 'Outlook',
  'hotmail.com': 'Hotmail',
  'live.com': 'Live',
  'yahoo.com': 'Yahoo',
  'foxmail.com': 'Foxmail',
  'sina.com': '新浪',
  'sohu.com': '搜狐',
  'aliyun.com': '阿里云',
  'icloud.com': 'iCloud',
  'proton.me': 'Proton',
  'pm.me': 'Proton',
};

const EMAIL_TYPE_COLORS: Record<string, string> = {
  'QQ': '#1E90FF',
  '163': '#E53935',
  '126': '#E53935',
  'Gmail': '#EA4335',
  'Outlook': '#0078D4',
  'Hotmail': '#0078D4',
  'Live': '#0078D4',
  'Yahoo': '#6001D2',
  'Foxmail': '#F90',
  '新浪': '#FF6A00',
  '搜狐': '#FF6A00',
  '阿里云': '#FF6A00',
  'iCloud': '#555',
  'Proton': '#8A2BE2',
};

function getEmailType(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return email;
  for (const [key, label] of Object.entries(EMAIL_TYPE_MAP)) {
    if (domain === key || domain.endsWith('.' + key)) return label;
  }
  return domain.split('.')[0] || domain;
}

function getEmailTypeColor(email: string): string {
  const type = getEmailType(email);
  return EMAIL_TYPE_COLORS[type] || '#6B7280';
}

const FOLDERS = [
  { key: 'INBOX', label: '收件箱', icon: InboxIcon },
  { key: 'STARRED', label: '星标邮件', icon: StarIcon },
  { key: 'SENT', label: '已发送', icon: SentIcon },
  { key: 'DRAFTS', label: '草稿箱', icon: DraftIcon },
  { key: 'TRASH', label: '已删除', icon: TrashIcon },
  { key: 'SPAM', label: '垃圾箱', icon: SpamIcon },
];

export default function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {});
  }, [location.pathname]);

  // 从 URL 解析当前文件夹
  const searchParams = new URLSearchParams(location.search);
  const currentFolder = searchParams.get('folder') || 'INBOX';
  const currentAccountId = searchParams.get('accountId');

  const isFolderActive = (key: string) => {
    if (key === currentFolder && !currentAccountId) return true;
    // INBOX is default when no folder specified
    if (key === 'INBOX' && !currentFolder && !currentAccountId) return true;
    return false;
  };

  const isAccountActive = (id: string) => currentAccountId === id;

  return (
    <div className="h-full flex flex-col">
      {/* 写邮件按钮 */}
      <div className="px-3 pt-3 pb-2">
        <Link
          to="/compose"
          onClick={onClose}
          className="flex items-center justify-center gap-1.5 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          写邮件
        </Link>
      </div>

      {/* 邮件文件夹 */}
      <nav className="flex-1 overflow-y-auto px-2">
        <div className="space-y-0.5">
          {FOLDERS.map(folder => {
            const active = isFolderActive(folder.key);
            // 除收件箱外的文件夹特殊处理
            let target = `/inbox${folder.key !== 'INBOX' ? `?folder=${folder.key}` : ''}`;
            if (folder.key === 'SENT') target = '/inbox?folder=已发送';
            if (folder.key === 'TRASH') target = '/inbox?folder=已删除';
            if (folder.key === 'SPAM') target = '/inbox?folder=垃圾箱';
            if (folder.key === 'DRAFTS') target = '/inbox?folder=草稿箱';
            if (folder.key === 'STARRED') target = '/inbox?folder=FLAGGED';
            return (
              <Link
                key={folder.key}
                to={target}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <folder.icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>{folder.label}</span>
              </Link>
            );
          })}
        </div>

        {/* 我的邮箱 */}
        {accounts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-400 px-3 mb-1 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 5-7-5" />
              </svg>
              我的邮箱
            </div>
            {accounts.map(account => (
              <Link
                key={account.id}
                to={`/inbox?accountId=${account.id}`}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isAccountActive(account.id)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: account.avatarColor || '#3B82F6' }}>
                  {account.avatarName || account.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span className="text-sm truncate">{account.name}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded font-medium leading-none flex-shrink-0"
                    style={{ backgroundColor: getEmailTypeColor(account.email) + '20', color: getEmailTypeColor(account.email) }}>
                    {getEmailType(account.email)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* 底部版本 */}
      <div className="px-4 py-2.5 border-t border-gray-100">
        <p className="text-[10px] text-gray-400">MailHub v1.0</p>
      </div>
    </div>
  );
}

// ---- SVG Icons ----

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function SentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function DraftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SpamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );
}
