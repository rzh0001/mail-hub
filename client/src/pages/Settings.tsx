import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSettings, updateSettings,
  getVerificationRules, addVerificationRule, deleteVerificationRule, toggleVerificationRule,
  getBuiltinVerificationRules, updateDisabledBuiltinRules,
  getForwardingRules, addForwardingRule, deleteForwardingRule, toggleForwardingRule,
  getTrashRules, addTrashRule, deleteTrashRule, toggleTrashRule,
  changePassword, verifyPassword,
} from '../services/api';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import type { SettingsMap, VerificationRule, BuiltinVerificationRule, ForwardingRule, TrashRule } from '../types';

const RULE_TYPE_LABEL: Record<string, string> = {
  subject_keyword: '主题关键词',
  sender_pattern: '发件人匹配',
};

export default function Settings() {
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [rules, setRules] = useState<VerificationRule[]>([]);
  const [builtinRules, setBuiltinRules] = useState<BuiltinVerificationRule[]>([]);
  const [disabledBuiltin, setDisabledBuiltin] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRuleType, setNewRuleType] = useState<'subject_keyword' | 'sender_pattern'>('subject_keyword');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newVcTarget, setNewVcTarget] = useState('');
  const { autoLockMinutes, setAutoLockMinutes } = useAuth();

  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passError, setPassError] = useState('');

  // 转发规则
  const [forwardingRules, setForwardingRules] = useState<ForwardingRule[]>([]);
  const [newForwardingType, setNewForwardingType] = useState<'subject_keyword' | 'sender_pattern'>('subject_keyword');
  const [newForwardingValue, setNewForwardingValue] = useState('');
  const [newForwardingTarget, setNewForwardingTarget] = useState('');

  // 垃圾箱规则
  const [trashRules, setTrashRules] = useState<TrashRule[]>([]);
  const [newTrashType, setNewTrashType] = useState<'subject_keyword' | 'sender_pattern'>('subject_keyword');
  const [newTrashValue, setNewTrashValue] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, r, b, f, t] = await Promise.all([
        getSettings(), getVerificationRules(), getBuiltinVerificationRules(),
        getForwardingRules(), getTrashRules(),
      ]);
      setSettings(s);
      setRules(r);
      setBuiltinRules(b.rules);
      setDisabledBuiltin(new Set(b.disabled));
      setForwardingRules(f);
      setTrashRules(t);
    } catch { toast('加载设置失败', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      toast('设置已保存', 'success');
    } catch { toast('保存失败', 'error'); }
    finally { setSaving(false); }
  };

  const set = (key: string, value: string) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  // --- 内置规则开关 ---
  const handleToggleBuiltin = async (id: string) => {
    const next = new Set(disabledBuiltin);
    if (next.has(id)) next.delete(id); else next.add(id);
    try {
      const result = await updateDisabledBuiltinRules([...next]);
      setDisabledBuiltin(new Set(result.disabled));
    } catch { toast('操作失败', 'error'); }
  };

  // --- 自定义规则 ---
  const handleAddRule = async () => {
    const val = newRuleValue.trim();
    if (!val) { toast('请输入规则内容', 'error'); return; }
    try {
      const rule = await addVerificationRule(newRuleType, val);
      setRules(prev => [...prev, rule]);
      setNewRuleValue('');
      toast('规则已添加', 'success');
    } catch { toast('添加失败', 'error'); }
  };

  const handleDeleteRule = async (id: number) => {
    const ok = await confirm('确定要删除该规则吗？');
    if (!ok) return;
    try {
      await deleteVerificationRule(id);
      setRules(prev => prev.filter(r => r.id !== id));
      toast('规则已删除', 'success');
    } catch { toast('删除失败', 'error'); }
  };

  const handleToggleRule = async (id: number) => {
    try {
      const updated = await toggleVerificationRule(id);
      setRules(prev => prev.map(r => r.id === id ? updated : r));
    } catch { toast('操作失败', 'error'); }
  };

  // --- 验证码转发 ---
  const getVcTargets = (): string[] => {
    try { return JSON.parse(settings.verification_forward_targets || '[]'); } catch { return []; }
  };

  const handleAddVcTarget = () => {
    const email = newVcTarget.trim();
    if (!email) { toast('请输入邮箱地址', 'error'); return; }
    const targets = getVcTargets();
    if (targets.includes(email)) { toast('该邮箱已存在', 'error'); return; }
    set('verification_forward_targets', JSON.stringify([...targets, email]));
    setNewVcTarget('');
    toast('转发邮箱已添加', 'success');
  };

  const handleRemoveVcTarget = (email: string) => {
    const targets = getVcTargets().filter(e => e !== email);
    set('verification_forward_targets', JSON.stringify(targets));
  };

  // --- 转发规则 ---
  const handleAddForwardingRule = async () => {
    const val = newForwardingValue.trim();
    const target = newForwardingTarget.trim();
    if (!val) { toast('请输入规则内容', 'error'); return; }
    if (!target) { toast('请输入转发目标邮箱', 'error'); return; }
    try {
      const rule = await addForwardingRule(newForwardingType, val, target);
      setForwardingRules(prev => [...prev, rule]);
      setNewForwardingValue('');
      setNewForwardingTarget('');
      toast('转发规则已添加', 'success');
    } catch { toast('添加失败', 'error'); }
  };

  const handleDeleteForwardingRule = async (id: number) => {
    const ok = await confirm('确定要删除该转发规则吗？');
    if (!ok) return;
    try {
      await deleteForwardingRule(id);
      setForwardingRules(prev => prev.filter(r => r.id !== id));
      toast('转发规则已删除', 'success');
    } catch { toast('删除失败', 'error'); }
  };

  const handleToggleForwardingRule = async (id: number) => {
    try {
      const updated = await toggleForwardingRule(id);
      setForwardingRules(prev => prev.map(r => r.id === id ? updated : r));
    } catch { toast('操作失败', 'error'); }
  };

  // --- 垃圾箱规则 ---
  const handleAddTrashRule = async () => {
    const val = newTrashValue.trim();
    if (!val) { toast('请输入规则内容', 'error'); return; }
    try {
      const rule = await addTrashRule(newTrashType, val);
      setTrashRules(prev => [...prev, rule]);
      setNewTrashValue('');
      toast('垃圾箱规则已添加', 'success');
    } catch { toast('添加失败', 'error'); }
  };

  const handleDeleteTrashRule = async (id: number) => {
    const ok = await confirm('确定要删除该垃圾箱规则吗？');
    if (!ok) return;
    try {
      await deleteTrashRule(id);
      setTrashRules(prev => prev.filter(r => r.id !== id));
      toast('垃圾箱规则已删除', 'success');
    } catch { toast('删除失败', 'error'); }
  };

  const handleToggleTrashRule = async (id: number) => {
    try {
      const updated = await toggleTrashRule(id);
      setTrashRules(prev => prev.map(r => r.id === id ? updated : r));
    } catch { toast('操作失败', 'error'); }
  };

  // --- 密码修改 ---
  const handleChangePassword = async () => {
    setPassError('');
    if (!oldPassword) { setPassError('请输入当前密码'); return; }
    if (!newPassword) { setPassError('请输入新密码'); return; }
    if (newPassword.length < 4 || newPassword.length > 64) { setPassError('密码长度需在 4-64 位之间'); return; }
    if (newPassword !== confirmPassword) { setPassError('两次输入的新密码不一致'); return; }
    setPasswordLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast('密码修改成功', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassError(err.message || '修改密码失败');
    } finally {
      setPasswordLoading(false);
    }
  };

  const [activeSection, setActiveSection] = useState('sync');

  const SIDEBAR_ITEMS = [
    { key: 'sync', label: '同步与锁屏', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { key: 'password', label: '锁屏密码', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { key: 'verification', label: '验证码规则', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'forwarding', label: '邮件转发', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { key: 'trash', label: '垃圾箱规则', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
    { key: 'accounts', label: '账户安全', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { key: 'about', label: '关于', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* ===== 左侧导航 ===== */}
      <div className="w-44 lg:w-52 flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
        <div className="p-3">
          <div className="mb-3 px-3">
            <h2 className="text-base font-bold text-gray-800">系统设置</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">全局偏好配置</p>
          </div>
          <div className="flex flex-col gap-0.5">
            {SIDEBAR_ITEMS.map(item => (
              <button key={item.key} onClick={() => setActiveSection(item.key)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  activeSection === item.key
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}>
                <svg className="w-4 h-4 flex-shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 右侧内容 ===== */}
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="max-w-3xl px-6 py-5">

          {/* 顶部操作栏 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold text-gray-800">
              {SIDEBAR_ITEMS.find(i => i.key === activeSection)?.label || '设置'}
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={() => { loadData(); toast('已刷新', 'info'); }}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                刷新
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? '保存中...' : '保存设置'}
              </button>
            </div>
          </div>

          {/* ===== 内容面板 ===== */}

          {/* 同步与锁屏 */}
          {activeSection === 'sync' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">自动同步间隔</p>
                    <p className="text-xs text-gray-400 mt-0.5">每隔多久自动同步新邮件</p>
                  </div>
                  <select value={settings.sync_interval || '2'} onChange={e => set('sync_interval', e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="0">手动同步</option>
                    <option value="2">2 分钟</option>
                    <option value="15">15 分钟</option>
                    <option value="30">30 分钟</option>
                    <option value="60">1 小时</option>
                    <option value="120">2 小时</option>
                    <option value="240">4 小时</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700">每次同步数量</p>
                    <p className="text-xs text-gray-400 mt-0.5">单次最多拉取的邮件数</p>
                  </div>
                  <select value={settings.sync_max_count || '50'} onChange={e => set('sync_max_count', e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                    <option value="20">20 封</option>
                    <option value="50">50 封</option>
                    <option value="100">100 封</option>
                    <option value="200">200 封</option>
                  </select>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">自动锁屏</p>
                      <p className="text-xs text-gray-400 mt-0.5">无操作后自动锁定屏幕</p>
                    </div>
                    <select value={String(autoLockMinutes)} onChange={e => {
                      const val = parseInt(e.target.value);
                      setAutoLockMinutes(val);
                      set('auto_lock_minutes', String(val));
                    }}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                      <option value="0">永不锁屏</option>
                      <option value="1">1 分钟</option>
                      <option value="3">3 分钟</option>
                      <option value="5">5 分钟</option>
                      <option value="10">10 分钟</option>
                      <option value="15">15 分钟</option>
                      <option value="30">30 分钟</option>
                    </select>
                  </div>
                  {autoLockMinutes > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-700 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>锁屏已启用，无操作 {autoLockMinutes} 分钟后自动锁定。</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 锁屏密码 */}
          {activeSection === 'password' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 space-y-4">
                <p className="text-xs text-gray-400">修改应用锁屏密码。默认密码为 123456。</p>
                <div className="space-y-3 max-w-sm">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">当前密码</label>
                    <input type="password" value={oldPassword} onChange={e => { setOldPassword(e.target.value); setPassError(''); }}
                      placeholder="输入当前密码"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">新密码</label>
                    <input type="password" value={newPassword} onChange={e => { setNewPassword(e.target.value); setPassError(''); }}
                      placeholder="4-64 位新密码"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">确认新密码</label>
                    <input type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setPassError(''); }}
                      placeholder="再次输入新密码"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {passError && <p className="text-xs text-red-500">{passError}</p>}
                  <button onClick={handleChangePassword} disabled={passwordLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50">
                    {passwordLoading ? '修改中...' : '修改密码'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 验证码规则 */}
          {activeSection === 'verification' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 space-y-5">
                {/* 自动标记已读 */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-700">自动标记已读</p>
                    <p className="text-xs text-gray-400 mt-0.5">识别为验证码的邮件自动标记为已读</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox"
                      checked={settings.auto_mark_verification !== 'false'}
                      onChange={e => set('auto_mark_verification', e.target.checked ? 'true' : 'false')}
                      className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                  </label>
                </div>

                {/* 验证码转发 */}
                <div className="pb-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">验证码转发</p>
                      <p className="text-xs text-gray-400 mt-0.5">检测到验证码时自动转发到指定邮箱</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox"
                        checked={settings.verification_forward_enabled === 'true'}
                        onChange={e => set('verification_forward_enabled', e.target.checked ? 'true' : 'false')}
                        className="sr-only peer" />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                  {settings.verification_forward_enabled === 'true' && (
                    <div className="pl-2 space-y-2">
                      {getVcTargets().length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">尚未配置转发邮箱</p>
                      ) : (
                        <div className="space-y-1.5 mb-2">
                          {getVcTargets().map(email => (
                            <div key={email} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-sm">
                              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-gray-700 flex-1">{email}</span>
                              <button onClick={() => handleRemoveVcTarget(email)}
                                className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">删除</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input type="email" placeholder="转发目标邮箱"
                          value={newVcTarget}
                          onChange={e => setNewVcTarget(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddVcTarget()}
                          className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500" />
                        <button onClick={handleAddVcTarget}
                          className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                          添加
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 内置规则列表 */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    内置规则 <span className="text-xs text-gray-400 font-normal">（系统预设，可单独关闭）</span>
                  </p>
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {builtinRules.map(rule => {
                      const isOff = disabledBuiltin.has(rule.id);
                      return (
                        <div key={rule.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isOff ? 'opacity-40' : 'bg-blue-50/30'}`}>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0 font-mono">{rule.id}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{RULE_TYPE_LABEL[rule.type]}</span>
                          <code className="text-xs text-gray-700 flex-1 truncate font-mono">{rule.value}</code>
                          <button onClick={() => handleToggleBuiltin(rule.id)}
                            className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${isOff ? 'text-gray-400 bg-gray-100' : 'text-green-600 bg-green-50'}`}>
                            {isOff ? '已关闭' : '已启用'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 自定义规则 */}
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    自定义规则 <span className="text-xs text-gray-400 font-normal">（可增删，与内置规则共同生效）</span>
                  </p>
                  {rules.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">暂无自定义规则</p>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {rules.map(rule => (
                        <div key={rule.id}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0">{RULE_TYPE_LABEL[rule.type]}</span>
                          <code className="text-xs text-gray-700 flex-1 truncate font-mono">{rule.value}</code>
                          <button onClick={() => handleToggleRule(rule.id)}
                            className={`text-xs px-1.5 py-0.5 rounded ${rule.enabled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                            {rule.enabled ? '启用' : '停用'}
                          </button>
                          <button onClick={() => handleDeleteRule(rule.id)}
                            className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">删除</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <select value={newRuleType} onChange={e => setNewRuleType(e.target.value as any)}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500">
                      <option value="subject_keyword">主题关键词</option>
                      <option value="sender_pattern">发件人匹配</option>
                    </select>
                    <input type="text"
                      placeholder={newRuleType === 'subject_keyword' ? '例如: 安全码' : '例如: @example\\.com'}
                      value={newRuleValue}
                      onChange={e => setNewRuleValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddRule()}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <button onClick={handleAddRule}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                      添加
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">支持正则表达式，不区分大小写。添加后下次加载邮件列表时生效。</p>
                </div>
              </div>
            </section>
          )}

          {/* 邮件转发 */}
          {activeSection === 'forwarding' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 space-y-4">
                <p className="text-xs text-gray-400">同步新邮件时，匹配转发规则的邮件将自动转发到目标邮箱。</p>
                {forwardingRules.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">暂无转发规则</p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {forwardingRules.map(rule => (
                      <div key={rule.id}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0">{RULE_TYPE_LABEL[rule.type]}</span>
                        <code className="text-xs text-gray-700 flex-1 truncate font-mono">{rule.value}</code>
                        <span className="text-xs text-gray-400 flex-shrink-0">→ {rule.target_email}</span>
                        <button onClick={() => handleToggleForwardingRule(rule.id)}
                          className={`text-xs px-1.5 py-0.5 rounded ${rule.enabled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                          {rule.enabled ? '启用' : '停用'}
                        </button>
                        <button onClick={() => handleDeleteForwardingRule(rule.id)}
                          className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">删除</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <select value={newForwardingType} onChange={e => setNewForwardingType(e.target.value as any)}
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500">
                    <option value="subject_keyword">主题关键词</option>
                    <option value="sender_pattern">发件人匹配</option>
                  </select>
                  <input type="text"
                    placeholder={newForwardingType === 'subject_keyword' ? '例如: 账单' : '例如: @newsletter\\.com'}
                    value={newForwardingValue}
                    onChange={e => setNewForwardingValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddForwardingRule()}
                    className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  <input type="email"
                    placeholder="转发到邮箱"
                    value={newForwardingTarget}
                    onChange={e => setNewForwardingTarget(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddForwardingRule()}
                    className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleAddForwardingRule}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                    添加
                  </button>
                </div>
                <p className="text-xs text-gray-400">支持正则表达式，不区分大小写。添加后下次同步邮件时生效。</p>
              </div>
            </section>
          )}

          {/* 垃圾箱规则 */}
          {activeSection === 'trash' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 space-y-4">
                <p className="text-xs text-gray-400">同步新邮件时，匹配垃圾箱规则的邮件将自动移入垃圾箱（标记为已删除）。</p>
                {trashRules.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">暂无垃圾箱规则</p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {trashRules.map(rule => (
                      <div key={rule.id}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0">{RULE_TYPE_LABEL[rule.type]}</span>
                        <code className="text-xs text-gray-700 flex-1 truncate font-mono">{rule.value}</code>
                        <button onClick={() => handleToggleTrashRule(rule.id)}
                          className={`text-xs px-1.5 py-0.5 rounded ${rule.enabled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                          {rule.enabled ? '启用' : '停用'}
                        </button>
                        <button onClick={() => handleDeleteTrashRule(rule.id)}
                          className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">删除</button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <select value={newTrashType} onChange={e => setNewTrashType(e.target.value as any)}
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500">
                    <option value="subject_keyword">主题关键词</option>
                    <option value="sender_pattern">发件人匹配</option>
                  </select>
                  <input type="text"
                    placeholder={newTrashType === 'subject_keyword' ? '例如: 广告' : '例如: @spam\\.com'}
                    value={newTrashValue}
                    onChange={e => setNewTrashValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTrashRule()}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleAddTrashRule}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                    添加
                  </button>
                </div>
                <p className="text-xs text-gray-400">支持正则表达式，不区分大小写。添加后下次同步邮件时自动转入垃圾箱。</p>
              </div>
            </section>
          )}

          {/* 账户安全 */}
          {activeSection === 'accounts' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4">
                <p className="text-sm text-gray-600 mb-3">管理邮箱账户的授权码和连接配置</p>
                <button onClick={() => navigate('/accounts')}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                  前往邮箱管理
                </button>
              </div>
            </section>
          )}

          {/* 关于 */}
          {activeSection === 'about' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 text-sm text-gray-500 space-y-1">
                <p>MailHub v1.0 — 邮箱聚合管理系统</p>
                <p>数据存储位置：服务端 SQLite 数据库</p>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
