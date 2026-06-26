import { useEffect, useState, useRef } from 'react';
import { getAccounts, createAccount, deleteAccount, updateAccount, testAccount, syncAccount, getProviders, getAccountConfig, exportAccounts, importAccounts } from '../services/api';
import { useUI } from '../contexts/UIContext';
import type { MailAccount, MailProvider, CreateAccountInput, UpdateAccountInput, AccountConfig, ImportResult } from '../types';

export default function Accounts() {
  const { confirm, toast } = useUI();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [providers, setProviders] = useState<MailProvider[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateAccountInput>({
    name: '', email: '', authCode: '', provider: '163',
  });

  // 配置查看弹窗
  const [configModal, setConfigModal] = useState<{ open: boolean; config: AccountConfig | null }>({ open: false, config: null });
  const [showAuthCode, setShowAuthCode] = useState(false);

  // 编辑弹窗
  const [editModal, setEditModal] = useState<{ open: boolean; account: MailAccount | null }>({ open: false, account: null });
  const [editForm, setEditForm] = useState<{ name: string; avatarName: string; avatarColor: string }>({ name: '', avatarName: '', avatarColor: '' });
  const [editSaving, setEditSaving] = useState(false);

  const AVATAR_COLORS = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  ];

  const getAvatarDisplay = (account: MailAccount) => {
    return account.avatarName || account.name.charAt(0).toUpperCase() || account.email.charAt(0).toUpperCase();
  };

  const getAvatarBg = (account: MailAccount) => {
    return account.avatarColor || '#3B82F6';
  };

  // 导入导出
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAccounts = () => getAccounts().then(setAccounts).catch(() => {});
  const loadProviders = () => getProviders().then(setProviders).catch(() => {});

  useEffect(() => { loadAccounts(); loadProviders(); }, []);

  useEffect(() => {
    if (form.provider) {
      const p = providers.find(x => x.id === form.provider);
      if (p) setForm(prev => ({ ...prev, imapHost: p.imapHost, imapPort: p.imapPort, imapSecure: p.imapSecure, smtpHost: p.smtpHost, smtpPort: p.smtpPort, smtpSecure: p.smtpSecure }));
    }
  }, [form.provider, providers]);

  // 添加账户
  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.authCode.trim()) {
      setError('请填写完整信息'); return;
    }
    setError('');
    try {
      await createAccount(form);
      setShowForm(false);
      setForm({ name: '', email: '', authCode: '', provider: '163' });
      loadAccounts();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm('确定要删除该邮箱账户吗？相关的邮件数据也会被删除。');
    if (!ok) return;
    try { await deleteAccount(id); loadAccounts(); toast('账户已删除', 'success'); }
    catch (err: any) { toast('删除失败: ' + err.message, 'error'); }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const result = await testAccount(id);
      if (result.connected) {
        toast('连接成功！IMAP 配置正确', 'success');
      } else {
        toast('连接失败，请检查配置和授权码', 'error');
      }
    } catch (err: any) { toast('测试失败: ' + err.message, 'error'); }
    finally { setTesting(null); }
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await syncAccount(id);
      toast(`同步完成，新增 ${result.synced} 封邮件`, 'success');
      loadAccounts();
    } catch (err: any) {
      toast('同步失败: ' + err.message, 'error');
    } finally {
      setSyncing(null);
    }
  };

  // 查看配置
  const handleViewConfig = async (id: string) => {
    try {
      const config = await getAccountConfig(id);
      setConfigModal({ open: true, config });
      setShowAuthCode(false);
    } catch (err: any) {
      toast('获取配置失败: ' + err.message, 'error');
    }
  };

  // 编辑账户
  const handleEdit = (account: MailAccount) => {
    setEditForm({
      name: account.name,
      avatarName: account.avatarName || '',
      avatarColor: account.avatarColor || AVATAR_COLORS[0],
    });
    setEditModal({ open: true, account });
  };

  const handleEditSave = async () => {
    if (!editModal.account) return;
    if (!editForm.name.trim()) { toast('账户名称不能为空', 'error'); return; }
    setEditSaving(true);
    try {
      const input: UpdateAccountInput = {
        name: editForm.name.trim(),
        avatarName: editForm.avatarName.trim(),
        avatarColor: editForm.avatarColor,
      };
      await updateAccount(editModal.account.id, input);
      setEditModal({ open: false, account: null });
      loadAccounts();
      toast('账户已更新', 'success');
    } catch (err: any) {
      toast('更新失败: ' + err.message, 'error');
    } finally {
      setEditSaving(false);
    }
  };

  // 导出
  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await exportAccounts();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mailhub-accounts-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast(`已导出 ${data.length} 个账户配置`, 'success');
    } catch (err: any) {
      toast('导出失败: ' + err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  // 导入
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      let accounts: CreateAccountInput[];
      try { accounts = JSON.parse(text); }
      catch { toast('文件格式错误，请上传有效的 JSON 文件', 'error'); return; }

      if (!Array.isArray(accounts)) accounts = [accounts];
      if (accounts.length === 0) { toast('文件中没有账户数据', 'error'); return; }

      const result = await importAccounts(accounts);
      setImportResult(result);
      loadAccounts();
      toast(`导入完成：成功 ${result.success} 个${result.failed > 0 ? `，失败 ${result.failed} 个` : ''}`,
        result.failed === 0 ? 'success' : 'info');
    } catch (err: any) { toast('导入失败: ' + err.message, 'error'); }
    finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const providerNames: Record<string, string> = {
    '163': '163邮箱', 'qq': 'QQ邮箱', 'gmail': 'Gmail', 'outlook': 'Outlook',
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">邮箱管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理你的邮箱账户，添加后即可聚合管理所有邮件</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 导入导出按钮 */}
          <button
            onClick={handleExport}
            disabled={exporting || accounts.length === 0}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? '导出中...' : '导出配置'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? '导入中...' : '导入配置'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            添加邮箱
          </button>
        </div>
      </div>

      {/* 添加账户表单 */}
      {showForm && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">添加邮箱账户</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          {/* 163邮箱配置指引 */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <p className="font-medium mb-1">📧 163邮箱配置指引：</p>
            <p>1. 登录 163 邮箱，进入「设置」→「POP3/SMTP/IMAP」</p>
            <p>2. 开启「IMAP/SMTP服务」，获取授权码</p>
            <p>3. 请使用<strong>授权码</strong>而非邮箱密码进行登录</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱提供商</label>
              <select value={form.provider} onChange={e => setForm(prev => ({ ...prev, provider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option value="163">163邮箱</option>
                <option value="qq">QQ邮箱</option>
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">账户名称</label>
              <input type="text" placeholder="例如：我的163邮箱" value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱地址</label>
              <input type="email" placeholder="example@163.com" value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">授权码</label>
              <input type="password" placeholder="邮箱授权码（非登录密码）" value={form.authCode}
                onChange={e => setForm(prev => ({ ...prev, authCode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">确认添加</button>
            <button onClick={() => { setShowForm(false); setError(''); }} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">取消</button>
          </div>
        </div>
      )}

      {/* 导入结果提示 */}
      {importResult && (
        <div className={`mb-6 p-4 rounded-xl border ${
          importResult.failed === 0
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium text-gray-800">导入完成</span>
              <span className="text-gray-600 ml-2">
                成功 {importResult.success} 个
                {importResult.failed > 0 && `，失败 ${importResult.failed} 个`}
              </span>
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {importResult.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-600 max-h-24 overflow-y-auto space-y-0.5">
              {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* 账户列表 */}
      {accounts.length === 0 && !showForm ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="text-gray-500 mb-2">还没有添加邮箱账户</p>
          <p className="text-gray-400 text-sm">点击右上角「添加邮箱」开始使用</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {accounts.map(account => (
            <div key={account.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 hover:shadow-md transition-shadow">
              {/* 头部：头像 + 名称 + 删除 */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: getAvatarBg(account) }}>
                  <span className="text-white font-semibold text-xs">{getAvatarDisplay(account)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-800 text-sm truncate">{account.name}</h3>
                  <p className="text-xs text-gray-400 truncate">{account.email}</p>
                </div>
                <button onClick={() => handleDelete(account.id)}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0" title="删除账户">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* 标签 */}
              <div className="flex items-center gap-1.5 mb-3">
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                  {providerNames[account.provider] || account.provider || '自定义'}
                </span>
                <span className="text-xs text-gray-400 truncate">{account.imapHost}:{account.imapPort}</span>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-1.5">
                <button onClick={() => handleEdit(account)}
                  className="px-2 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">编辑</button>
                <button onClick={() => handleViewConfig(account.id)}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">配置</button>
                <button onClick={() => handleTest(account.id)} disabled={testing === account.id}
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40">
                  {testing === account.id ? '···' : '测试'}</button>
                <button onClick={() => handleSync(account.id)} disabled={syncing === account.id}
                  className="flex-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {syncing === account.id ? '···' : '同步'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑弹窗 */}
      {editModal.open && editModal.account && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setEditModal({ open: false, account: null })}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">编辑账户</h2>
              <button onClick={() => setEditModal({ open: false, account: null })}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* 头像预览 */}
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                  style={{ backgroundColor: editForm.avatarColor || '#3B82F6' }}>
                  {editForm.avatarName || editForm.name.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="text-sm text-gray-500">
                  <p className="font-medium text-gray-700">{editForm.name || '账户名称'}</p>
                  <p className="text-xs text-gray-400">{editModal.account.email}</p>
                </div>
              </div>

              {/* 账户名称 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">账户名称</label>
                <input type="text" value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>

              {/* 头像显示名 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">头像显示名</label>
                <input type="text" placeholder="留空则显示账户首字" value={editForm.avatarName}
                  onChange={e => setEditForm(prev => ({ ...prev, avatarName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>

              {/* 头像颜色 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">头像颜色</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {AVATAR_COLORS.map(color => (
                    <button key={color}
                      onClick={() => setEditForm(prev => ({ ...prev, avatarColor: color }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        editForm.avatarColor === color ? 'border-gray-800 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">自定义：</span>
                  <input type="text" placeholder="#3B82F6" value={editForm.avatarColor}
                    onChange={e => setEditForm(prev => ({ ...prev, avatarColor: e.target.value }))}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono" />
                  <input type="color" value={editForm.avatarColor || '#3B82F6'}
                    onChange={e => setEditForm(prev => ({ ...prev, avatarColor: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-300" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={handleEditSave} disabled={editSaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50">
                {editSaving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => setEditModal({ open: false, account: null })}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 配置详情弹窗 */}
      {configModal.open && configModal.config && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setConfigModal({ open: false, config: null })}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800">邮箱配置详情</h2>
              <button onClick={() => setConfigModal({ open: false, config: null })}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <ConfigRow label="账户名称" value={configModal.config.name} />
              <ConfigRow label="邮箱地址" value={configModal.config.email} />
              <ConfigRow label="邮箱提供商" value={providerNames[configModal.config.provider] || configModal.config.provider || '自定义'} />
              {configModal.config.avatarName && <ConfigRow label="头像显示名" value={configModal.config.avatarName} />}
              {configModal.config.avatarColor && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">头像颜色</span>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border" style={{ backgroundColor: configModal.config.avatarColor }} />
                    <span className="text-sm text-gray-800 font-medium">{configModal.config.avatarColor}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3" />
              <h3 className="text-sm font-medium text-gray-700 mb-2">IMAP 配置（收件）</h3>
              <ConfigRow label="服务器" value={`${configModal.config.imapHost}:${configModal.config.imapPort}`} />
              <ConfigRow label="加密方式" value={configModal.config.imapSecure ? 'SSL/TLS' : 'STARTTLS/无'} />

              <div className="border-t border-gray-100 pt-3" />
              <h3 className="text-sm font-medium text-gray-700 mb-2">SMTP 配置（发件）</h3>
              <ConfigRow label="服务器" value={`${configModal.config.smtpHost}:${configModal.config.smtpPort}`} />
              <ConfigRow label="加密方式" value={configModal.config.smtpSecure ? 'SSL/TLS' : 'STARTTLS/无'} />

              <div className="border-t border-gray-100 pt-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">授权码</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-gray-800">
                    {showAuthCode ? configModal.config.authCode : '••••••••'}
                  </span>
                  <button onClick={() => setShowAuthCode(!showAuthCode)}
                    className="text-blue-600 hover:text-blue-700 text-xs flex-shrink-0">
                    {showAuthCode ? '隐藏' : '显示'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">授权码仅在此显示，请勿分享给他人</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 配置信息行
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value}</span>
    </div>
  );
}
