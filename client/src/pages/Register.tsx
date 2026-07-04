import { useEffect, useState, useRef, useCallback } from 'react';
import { getWebsites, addWebsite, assignEmail, registerEmail, unregisterEmail, getWebsiteMails, getRegistries, syncAccount } from '../services/api';
import { useUI } from '../contexts/UIContext';
import type { Website, AssignedResult, WebsiteMail } from '../services/api';

interface RegistryEntry {
  id: number;
  accountId: string;
  accountEmail: string;
  accountName: string;
  websiteId: number;
  createdAt: string;
}

const FAVICON_URL = 'https://www.google.com/s2/favicons?domain=';
const STORAGE_KEY = 'register_page_state';

function saveState(data: Record<string, any>) {
  try {
    const existing = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  } catch { /* ignore */ }
}

function loadState(): Record<string, any> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function clearState() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export default function Register() {
  const { toast } = useUI();
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);

  // 分配结果面板
  const [assignResult, setAssignResult] = useState<AssignedResult | null>(null);
  const [assignWebsiteId, setAssignWebsiteId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [mails, setMails] = useState<WebsiteMail[]>([]);
  const [registered, setRegistered] = useState(false);
  const [expandedMails, setExpandedMails] = useState<Set<string>>(new Set());
  const [registries, setRegistries] = useState<RegistryEntry[]>([]);
  const [showRegistries, setShowRegistries] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const assignTimeRef = useRef<string>('');
  const syncAccountIdRef = useRef<string>('');
  const syncWebsiteIdRef = useRef<number>(0);

  const loadWebsites = useCallback(() => {
    getWebsites()
      .then(setWebsites)
      .catch(() => toast('获取网站列表失败', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    loadWebsites();
    // 恢复之前的页面状态
    const saved = loadState();
    if (saved.assignResult && saved.assignWebsiteId) {
      setAssignResult(saved.assignResult);
      setAssignWebsiteId(saved.assignWebsiteId);
      setRegistered(saved.registered || false);
      setMails(saved.mails || []);
      setRegistries(saved.registries || []);
      assignTimeRef.current = saved.assignTime || new Date().toISOString();
      syncAccountIdRef.current = saved.syncAccountId || '';
      syncWebsiteIdRef.current = saved.syncWebsiteId || 0;
      // 恢复倒计时
      if (syncAccountIdRef.current && syncWebsiteIdRef.current) {
        startCountdown();
      }
      if ((saved.mails || []).length > 0) {
        setExpandedMails(new Set([saved.mails[0].id]));
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // 页面状态持久化：关键状态变化时保存到 sessionStorage
  useEffect(() => {
    if (assignResult && assignWebsiteId) {
      saveState({
        assignResult,
        assignWebsiteId,
        registered,
        mails,
        registries,
        assignTime: assignTimeRef.current,
        syncAccountId: syncAccountIdRef.current,
        syncWebsiteId: syncWebsiteIdRef.current,
      });
    } else {
      clearState();
    }
  }, [assignResult, assignWebsiteId, registered, mails, registries]);

  // 添加域名
  const handleAdd = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) { toast('请输入域名', 'info'); return; }
    if (!domain.includes('.') || domain.includes(' ')) { toast('请输入有效的域名，如 github.com', 'error'); return; }
    setAdding(true);
    try {
      await addWebsite(domain);
      setNewDomain('');
      toast('网站已添加', 'success');
      loadWebsites();
    } catch (err: any) { toast(err.message || '添加失败', 'error'); }
    finally { setAdding(false); }
  };

  // 随机分配
  const handleAssign = async (website: Website) => {
    if (assignWebsiteId === website.id && assignResult) {
      // 已经选中，取消选择
      stopCountdown();
      setAssignResult(null);
      setAssignWebsiteId(null);
      setMails([]);
      setExpandedMails(new Set());
      setRegistered(false);
      setRegistries([]);
      setShowRegistries(false);
      return;
    }

    setAssigning(website.id);
    try {
      const result = await assignEmail(website.id);
      if (!result) {
        toast('所有邮箱均已注册该网站', 'info');
        return;
      }
      stopCountdown();
      setAssignResult(result);
      setAssignWebsiteId(website.id);
      setMails([]);
      setExpandedMails(new Set());
      setRegistered(false);
      setShowRegistries(false);

      // 先查已有邮件（不含时间过滤）
      fetchMails(website.id, result.accountId, '');
      assignTimeRef.current = new Date().toISOString();
      syncAccountIdRef.current = result.accountId;
      syncWebsiteIdRef.current = website.id;
      // 保存 ref 到 sessionStorage
      saveState({
        assignTime: assignTimeRef.current,
        syncAccountId: syncAccountIdRef.current,
        syncWebsiteId: syncWebsiteIdRef.current,
      });
      // 启动倒计时，到时自动同步+查新邮件
      startCountdown();
      fetchRegistries(website.id);
    } catch (err: any) { toast(err.message || '分配失败', 'error'); }
    finally { setAssigning(null); }
  };

  const handleRegister = async () => {
    if (!assignResult || !assignWebsiteId) return;
    try {
      await registerEmail(assignWebsiteId, assignResult.accountId);
      setRegistered(true);
      toast('已标记为已注册', 'success');
      loadWebsites();
      fetchRegistries(assignWebsiteId);
    } catch (err: any) { toast(err.message || '操作失败', 'error'); }
  };

  const handleUnregister = async (entry: { websiteId: number; accountId: string }) => {
    try {
      await unregisterEmail(entry.websiteId, entry.accountId);
      toast('注册已中断', 'success');
      // 关闭右侧面板
      stopCountdown();
      setAssignResult(null);
      setAssignWebsiteId(null);
      setMails([]);
      setExpandedMails(new Set());
      setRegistered(false);
      setRegistries([]);
      setShowRegistries(false);
      clearState();
      loadWebsites();
    } catch (err: any) { toast(err.message || '取消失败', 'error'); }
  };

  const fetchMails = async (websiteId: number, accountId: string, since: string) => {
    try {
      const result = await getWebsiteMails(websiteId, accountId, since);
      if (result.length > 0) {
        setMails(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMails = result.filter(m => !existingIds.has(m.id));
          if (newMails.length > 0 && prev.length === 0) {
            // 首次加载，默认展开最新一封
            setExpandedMails(new Set([newMails[0].id]));
          }
          return [...newMails, ...prev];
        });
      }
    } catch { /* 静默 */ }
  };

  const doSyncAndFetch = async () => {
    const accountId = syncAccountIdRef.current;
    const websiteId = syncWebsiteIdRef.current;
    if (!accountId || !websiteId) return;
    setSyncing(true);
    try {
      await syncAccount(accountId, 'INBOX', 10);
      await fetchMails(websiteId, accountId, assignTimeRef.current);
    } catch { /* 静默 */ }
    finally { setSyncing(false); }
  };

  const startCountdown = () => {
    stopCountdown();
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // 倒计时结束，触发同步
          doSyncAndFetch();
          return 5; // 重置倒计时
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchRegistries = async (websiteId: number) => {
    try {
      const data = await getRegistries(websiteId);
      setRegistries(data);
    } catch { /* 静默 */ }
  };

  const stopCountdown = () => {
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = undefined; }
    setCountdown(0);
  };

  const handleCopy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('已复制到剪贴板', 'success'); }
    catch { toast('复制失败', 'error'); }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="h-full flex">
      {/* ===== 左侧：卡片列表（固定区域，不抖动） ===== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-gray-50">
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
          <div>
            <h1 className="text-sm font-bold text-gray-800">账号注册</h1>
            <p className="text-[10px] text-gray-400">分配未注册邮箱 · 自动收验证码</p>
          </div>
          {/* 添加域名（紧凑行内） */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="域名"
              className="w-32 px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleAdd}
              disabled={adding}
              className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加
            </button>
          </div>
        </div>

        {/* 卡片网格 */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center h-full"><div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" /></div>
          ) : websites.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 text-xs">
              <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              <p>还没有网站</p>
              <p className="mt-0.5">输入域名添加，或同步邮件后自动发现</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
              {websites.map(website => (
                <div
                  key={website.id}
                  className={`bg-white rounded-lg border shadow-sm transition-all cursor-pointer ${
                    assignWebsiteId === website.id
                      ? 'border-blue-500 ring-1 ring-blue-200'
                      : 'border-gray-100 hover:border-gray-300'
                  }`}
                  onClick={() => handleAssign(website)}
                >
                  <div className="flex flex-col items-center justify-center py-3 gap-2">
                    <img
                      src={`${FAVICON_URL}${website.domain}`}
                      alt=""
                      className="w-6 h-6 rounded flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <h3 className="text-xs font-medium text-gray-800 text-center truncate w-full px-1">{website.domain}</h3>
                    <span className="text-[10px] text-gray-400">{website.registeredCount}/{website.totalAccounts}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        {websites.length > 0 && (
          <div className="px-3 py-1.5 border-t border-gray-100 bg-white flex-shrink-0">
            <p className="text-[10px] text-gray-300 text-center">{websites.length} 个网站 · 自动感知新网站</p>
          </div>
        )}
      </div>

      {/* ===== 右侧：注册区（始终预留空间，不抖动） ===== */}
      <div className="w-[560px] border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden flex-shrink-0">
        {assignResult ? (
          <>
            {/* 头部 */}
            <div className="px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-gray-800">实时邮箱</span>
              </div>
              <button
                onClick={() => { stopCountdown(); setAssignResult(null); setAssignWebsiteId(null); setMails([]); setExpandedMails(new Set()); setRegistered(false); setRegistries([]); setShowRegistries(false); }}
                className="p-1 hover:bg-white/60 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 邮箱信息 */}
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                  {assignResult.email.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 truncate">{assignResult.accountName}</p>
                  <p className="text-xs text-gray-500 truncate">{assignResult.email}</p>
                </div>
                <button
                  onClick={() => handleCopy(assignResult.email)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                  title="复制邮箱地址"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://${assignResult.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 bg-blue-50 rounded-lg px-2 py-1 truncate flex-1 hover:bg-blue-100 hover:underline transition-colors"
                >
                  {assignResult.domain}
                </a>
                <button
                  onClick={handleRegister}
                  disabled={registered}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium flex items-center gap-1 flex-shrink-0 ${
                    registered
                      ? 'bg-green-100 text-green-700 border border-green-200 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
                  已注册
                </button>
                {assignResult && (
                  <button
                    onClick={() => handleUnregister({ websiteId: assignWebsiteId!, accountId: assignResult.accountId })}
                    className="px-3 py-1.5 text-xs rounded-lg font-medium text-red-500 hover:bg-red-50 border border-red-200 transition-colors flex-shrink-0 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    中断
                  </button>
                )}
              </div>
            </div>

            {/* 邮件卡片列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">收件</h3>
                <div className="flex items-center gap-1.5">
                  {syncing && <span className="animate-spin w-2.5 h-2.5 border-2 border-orange-400 border-t-transparent rounded-full inline-block" />}
                  <span className="text-xs text-orange-500 tabular-nums">{countdown}s</span>
                </div>
              </div>

              {mails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-xs">等待来自 {assignResult.domain} 的邮件</p>
                </div>
              ) : (
                mails.map(mail => {
                  const isExpanded = expandedMails.has(mail.id);
                  return (
                    <div key={mail.id} className="border border-gray-100 rounded-lg overflow-hidden">
                      {/* 卡片头部（可点击折叠/展开） */}
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                        onClick={() => {
                          setExpandedMails(prev => {
                            const next = new Set(prev);
                            if (next.has(mail.id)) next.delete(mail.id);
                            else next.add(mail.id);
                            return next;
                          });
                        }}
                      >
                        <svg className={`w-3 h-3 text-gray-300 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs truncate ${mail.verificationCode ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                              {mail.subject || '(无主题)'}
                            </span>
                            {mail.verificationCode && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-green-50 text-green-600 font-bold font-mono flex-shrink-0 border border-green-200">
                                {mail.verificationCode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                            <span>{formatTime(mail.receivedAt)}</span>
                            <span>{mail.fromAddress}</span>
                          </div>
                        </div>
                      </button>

                      {/* 展开的邮件内容 */}
                      {isExpanded && (
                        <div className="border-t border-gray-50 bg-gray-50/30">
                          <div className="px-3 py-2 text-[10px] text-gray-400 flex items-center gap-3 border-b border-gray-100">
                            <span>从 <strong className="text-gray-500">{mail.fromAddress}</strong></span>
                            <span>于 <strong className="text-gray-500">{formatTime(mail.receivedAt)}</strong></span>
                          </div>
                          <div className="px-3 py-2 max-h-80 overflow-y-auto">
                            {mail.bodyHtml ? (
                              <div className="text-xs text-gray-700 leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full" dangerouslySetInnerHTML={{ __html: mail.bodyHtml }} />
                            ) : (
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words font-sans leading-relaxed">{mail.bodyText || '(无内容)'}</pre>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* 已注册邮箱 */}
            <div className="border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowRegistries(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-green-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-medium text-green-700">已注册邮箱</span>
                  <span className="text-[10px] text-green-600 bg-green-100 rounded-full px-1.5 py-0.5">{registries.length}</span>
                </div>
                <svg className={`w-3.5 h-3.5 text-green-400 transition-transform ${showRegistries ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showRegistries && (
                <div className="max-h-48 overflow-y-auto border-t border-green-50">
                  {registries.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-gray-300">暂无已注册邮箱</div>
                  ) : (
                    <div className="px-3 py-2 space-y-1">
                      {registries.map(entry => (
                        <div key={entry.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-green-50/50">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-[10px] font-medium flex-shrink-0">
                            {entry.accountName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-green-800 truncate">{entry.accountName}</p>
                            <p className="text-[10px] text-green-500 truncate">{entry.accountEmail}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopy(entry.accountEmail); }}
                            className="p-1 text-green-400 hover:text-green-600 hover:bg-green-100 rounded transition-colors flex-shrink-0"
                            title="复制邮箱"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUnregister(entry); }}
                            className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                            title="注册失败"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* 空状态占位 - 保证右侧区域始终存在，布局不抖动 */
          <div className="flex flex-col items-center justify-center h-full text-gray-200">
            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-gray-300">选择一个网站分配邮箱</p>
          </div>
        )}
      </div>
    </div>
  );
}
