import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSettings, updateSettings,
  getVerificationRules, addVerificationRule, deleteVerificationRule, toggleVerificationRule,
  getBuiltinVerificationRules, updateDisabledBuiltinRules,
  getForwardingRules, addForwardingRule, deleteForwardingRule, toggleForwardingRule, updateForwardingRuleMethod,
  getTrashRules, addTrashRule, deleteTrashRule, toggleTrashRule,
  changePassword, verifyPassword,
  testServerChan, testWecomBot, testFeishuBot, testVerificationRules,
  getForwardingMethods, addForwardingMethod, updateForwardingMethod, deleteForwardingMethod, setDefaultForwardingMethod,
  getMail, getMails,
} from '../services/api';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import type { SettingsMap, VerificationRule, BuiltinVerificationRule, ForwardingRule, ForwardingMethod, TrashRule, MailSummary } from '../types';

const RULE_TYPE_LABEL: Record<string, string> = {
  subject_keyword: '关键词',
  sender_pattern: '发件人匹配',
};

const METHOD_TYPE_LABEL: Record<string, string> = {
  email: '邮件',
  serverchan: 'Server酱',
  wecom_bot: '企业微信',
  feishu_bot: '飞书',
};

const METHOD_TYPE_DESC: Record<string, string> = {
  email: '通过 SMTP 转发到指定邮箱',
  serverchan: '通过 Server酱 服务号推送到微信',
  wecom_bot: '通过企业微信群机器人推送',
  feishu_bot: '通过飞书群机器人推送',
};

const METHOD_TYPE_LINKS: Record<string, string> = {
  serverchan: 'https://sct.ftqq.com',
};

/** 单张转发方式卡片 */
function MethodCard({ method, onToggle, onUpdate, onSetDefault, onDelete, onTest }: {
  method: ForwardingMethod;
  onToggle: (id: number, enabled: boolean) => void;
  onUpdate: (id: number, data: { name?: string; target?: string }) => Promise<void>;
  onSetDefault: (id: number) => void;
  onDelete: (id: number, name: string) => void;
  onTest: (id: number, type: string, target: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(method.name);
  const [editTarget, setEditTarget] = useState(method.target);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSave = async () => {
    try {
      await onUpdate(method.id, { name: editName.trim() || undefined, target: editTarget.trim() || undefined });
      setEditing(false);
    } catch { /* ignored */ }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult('idle');
    try {
      const ok = await onTest(method.id, method.type, method.target);
      setTestResult(ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const hasTest = method.type !== 'email' && !!method.target;

  return (
    <div className={`border rounded-xl p-4 transition-colors ${method.is_default ? 'border-blue-400 bg-blue-50/40' : method.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50/60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input type="text" value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
              <input type="text" value={editTarget}
                onChange={e => setEditTarget(e.target.value)}
                placeholder="目标地址"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500" />
              <div className="flex items-center gap-2">
                <button onClick={handleSave}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                <button onClick={() => { setEditing(false); setEditName(method.name); setEditTarget(method.target); }}
                  className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-100">取消</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0 font-mono">
                  {METHOD_TYPE_LABEL[method.type] || method.type}
                </span>
                <span className={`text-sm font-medium ${method.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                  {method.name}
                </span>
                {method.is_default ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">默认</span>
                ) : null}
                {!method.enabled && <span className="text-[10px] text-gray-400">（已停用）</span>}
              </div>
              <p className={`text-xs mt-1 truncate ${method.enabled ? 'text-gray-500' : 'text-gray-300'}`}>
                {method.type === 'email' ? `📧 ${method.target || '未设置'}` :
                 method.type === 'serverchan' ? `🔔 ${method.target ? '已配置 SendKey' : '未配置 SendKey'}` :
                 `🤖 ${method.target ? '已配置 Webhook' : '未配置 Webhook'}`}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{METHOD_TYPE_DESC[method.type] || ''}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!editing && (
            <>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={!!method.enabled}
                  onChange={e => onToggle(method.id, e.target.checked)}
                  className="sr-only peer" />
                <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600" />
              </label>
              {hasTest && method.enabled && (
                <button onClick={handleTest} disabled={testing}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    testResult === 'success' ? 'bg-green-50 text-green-600' :
                    testResult === 'error' ? 'bg-red-50 text-red-500' :
                    'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                  }`}>
                  {testing ? '测试中...' : testResult === 'success' ? '✓ 成功' : testResult === 'error' ? '✗ 失败' : '测试'}
                </button>
              )}
              {!method.is_default && method.enabled && (
                <button onClick={() => onSetDefault(method.id)}
                  className="text-xs px-1.5 py-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="设为默认">默认</button>
              )}
              <button onClick={() => { setEditing(true); setEditName(method.name); setEditTarget(method.target); }}
                className="text-xs px-1.5 py-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">编辑</button>
              <button onClick={() => onDelete(method.id, method.name)}
                className="text-xs px-1.5 py-0.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded">删除</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [rules, setRules] = useState<VerificationRule[]>([]);
  const [builtinRules, setBuiltinRules] = useState<BuiltinVerificationRule[]>([]);
  const [disabledBuiltin, setDisabledBuiltin] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newVcTarget, setNewVcTarget] = useState('');
  
  // 添加规则弹窗
  const [showAddRule, setShowAddRule] = useState(false);
  const [addRuleType, setAddRuleType] = useState<'subject_keyword' | 'sender_pattern'>('subject_keyword');
  const [addRuleValue, setAddRuleValue] = useState('');
  const [addRuleLoading, setAddRuleLoading] = useState(false);
  const { autoLockMinutes, setAutoLockMinutes } = useAuth();

  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passError, setPassError] = useState('');

  // 验证码规则测试
  const [testSubject, setTestSubject] = useState('');
  const [testBody, setTestBody] = useState('');
  const [testFrom, setTestFrom] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ matched: boolean; code: string | null; rules: Array<{ id: string; type: string; value: string; isBuiltin: boolean; enabled: boolean; matched: boolean }> } | null>(null);

  // 邮件选择弹窗
  const [showMailPicker, setShowMailPicker] = useState(false);
  const [mailList, setMailList] = useState<MailSummary[]>([]);
  const [mailListLoading, setMailListLoading] = useState(false);
  const [mailListQuery, setMailListQuery] = useState('');
  const [mailListTotal, setMailListTotal] = useState(0);

  // 微信推送测试
  const [wechatTesting, setWechatTesting] = useState(false);
  const [wechatTestResult, setWechatTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [wecomTesting, setWecomTesting] = useState(false);
  const [wecomTestResult, setWecomTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [feishuTesting, setFeishuTesting] = useState(false);
  const [feishuTestResult, setFeishuTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  // 转发规则
  const [forwardingRules, setForwardingRules] = useState<ForwardingRule[]>([]);
  const [forwardingMethods, setForwardingMethods] = useState<ForwardingMethod[]>([]);
  const [newForwardingType, setNewForwardingType] = useState<'subject_keyword' | 'sender_pattern'>('subject_keyword');
  const [newForwardingValue, setNewForwardingValue] = useState('');
  const [newForwardingMethodId, setNewForwardingMethodId] = useState<number>(-1);
  // 转发规则编辑中的 methodId
  const [editingMethodId, setEditingMethodId] = useState<Record<number, number>>({});
  // 新增转发方式表单
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethodType, setNewMethodType] = useState<'email' | 'serverchan' | 'wecom_bot' | 'feishu_bot'>('email');
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodTarget, setNewMethodTarget] = useState('');
  const [addMethodLoading, setAddMethodLoading] = useState(false);

  // 垃圾箱规则
  const [trashRules, setTrashRules] = useState<TrashRule[]>([]);
  const [newTrashType, setNewTrashType] = useState<'subject_keyword' | 'sender_pattern'>('subject_keyword');
  const [newTrashValue, setNewTrashValue] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, r, b, f, t, m] = await Promise.all([
        getSettings(), getVerificationRules(), getBuiltinVerificationRules(),
        getForwardingRules(), getTrashRules(), getForwardingMethods(),
      ]);
      setSettings(s);
      setRules(r);
      setBuiltinRules(b.rules);
      setDisabledBuiltin(new Set(b.disabled));
      setForwardingRules(f);
      setTrashRules(t);
      setForwardingMethods(m);
      // 初始化编辑中的 methodId 状态
      const em: Record<number, number> = {};
      for (const rule of f) {
        em[rule.id] = rule.method_id ?? -1;
      }
      setEditingMethodId(em);
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
    const val = addRuleValue.trim();
    if (!val) { toast('请输入规则内容', 'error'); return; }
    setAddRuleLoading(true);
    try {
      const rule = await addVerificationRule(addRuleType, val);
      setRules(prev => [...prev, rule]);
      setShowAddRule(false);
      setAddRuleValue('');
      toast('规则已添加', 'success');
    } catch { toast('添加失败', 'error'); }
    finally { setAddRuleLoading(false); }
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

  // --- 验证码规则测试 ---
  const handleTestVerification = async () => {
    if (!testSubject.trim() && !testBody.trim()) { toast('请至少输入主题或正文', 'error'); return; }
    setTestLoading(true);
    try {
      const result = await testVerificationRules({
        subject: testSubject,
        bodyText: testBody,
        fromAddress: testFrom.trim() || undefined,
      });
      setTestResult(result);
    } catch (err: any) {
      toast(err.message || '测试失败', 'error');
    } finally { setTestLoading(false); }
  };

  const handleOpenMailPicker = async () => {
    setMailListLoading(true);
    try {
      const result = await getMails({ page: 1, pageSize: 100 });
      setMailList(result.mails);
      setMailListTotal(result.total);
      setMailListQuery('');
      setShowMailPicker(true);
    } catch { toast('加载邮件列表失败', 'error'); }
    finally { setMailListLoading(false); }
  };

  const handleSearchMails = (q: string) => {
    setMailListQuery(q);
  };

  const filteredMailList = mailListQuery.trim()
    ? mailList.filter(m => {
        const q = mailListQuery.toLowerCase();
        return m.subject.toLowerCase().includes(q) || m.fromAddress.toLowerCase().includes(q) || m.fromName.toLowerCase().includes(q);
      })
    : mailList;

  const handleSelectMail = async (id: string) => {
    setShowMailPicker(false);
    try {
      const mail = await getMail(id);
      setTestFrom(mail.fromAddress || '');
      setTestSubject(mail.subject || '');
      setTestBody(mail.bodyText || '');
      toast('已填入邮件内容', 'success');
    } catch { toast('获取邮件详情失败', 'error'); }
  };

  // --- 转发规则 ---
  const handleAddForwardingRule = async () => {
    const val = newForwardingValue.trim();
    if (!val) { toast('请输入规则内容', 'error'); return; }
    const methodId = newForwardingMethodId > 0 ? newForwardingMethodId : undefined;
    try {
      const rule = await addForwardingRule(newForwardingType, val, methodId);
      setForwardingRules(prev => [...prev, rule]);
      setEditingMethodId(prev => ({ ...prev, [rule.id]: rule.method_id ?? -1 }));
      setNewForwardingValue('');
      toast('转发规则已添加', 'success');
    } catch { toast('添加失败', 'error'); }
  };

  // 更新转发规则关联的方法
  const handleUpdateRuleMethod = async (ruleId: number, methodId: number) => {
    try {
      const updated = await updateForwardingRuleMethod(ruleId, methodId > 0 ? methodId : null);
      setForwardingRules(prev => prev.map(r => r.id === ruleId ? updated : r));
      setEditingMethodId(prev => ({ ...prev, [ruleId]: methodId }));
      toast('转发方法已更新', 'success');
    } catch { toast('更新失败', 'error'); }
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

  // --- 转发方式 ---
  const handleAddMethod = async () => {
    if (!newMethodTarget.trim() && newMethodType !== 'email') { toast('请输入目标地址', 'error'); return; }
    if (newMethodType === 'email' && !newMethodTarget.trim()) { toast('请输入邮箱地址', 'error'); return; }
    setAddMethodLoading(true);
    try {
      const method = await addForwardingMethod(newMethodType, newMethodName || undefined, newMethodTarget.trim());
      setForwardingMethods(prev => [...prev, method]);
      setShowAddMethod(false);
      setNewMethodName('');
      setNewMethodTarget('');
      toast('转发方式已添加', 'success');
    } catch (err: any) { toast(err.message || '添加失败', 'error'); }
    finally { setAddMethodLoading(false); }
  };

  const handleDeleteMethod = async (id: number, name: string) => {
    const ok = await confirm(`确定要删除「${name}」吗？`);
    if (!ok) return;
    try {
      await deleteForwardingMethod(id);
      setForwardingMethods(prev => prev.filter(m => m.id !== id));
      toast('已删除', 'success');
    } catch { toast('删除失败', 'error'); }
  };

  const handleToggleMethod = async (id: number, enabled: boolean) => {
    try {
      const updated = await updateForwardingMethod(id, { enabled });
      setForwardingMethods(prev => prev.map(m => m.id === id ? updated : m));
    } catch { toast('操作失败', 'error'); }
  };

  const handleSetDefaultMethod = async (id: number) => {
    try {
      const updated = await setDefaultForwardingMethod(id);
      setForwardingMethods(prev => prev.map(m => m.id === id ? updated : { ...m, is_default: 0 }));
    } catch { toast('操作失败', 'error'); }
  };

  const handleUpdateMethodInfo = async (id: number, data: { name?: string; target?: string }) => {
    try {
      const updated = await updateForwardingMethod(id, data);
      setForwardingMethods(prev => prev.map(m => m.id === id ? updated : m));
      toast('已更新', 'success');
    } catch { toast('更新失败', 'error'); }
  };

  const handleTestMethod = async (id: number, type: string, target: string): Promise<boolean> => {
    try {
      if (type === 'serverchan') {
        await testServerChan(target);
      } else if (type === 'wecom_bot') {
        await testWecomBot(target);
      } else if (type === 'feishu_bot') {
        await testFeishuBot(target);
      }
      toast('测试成功', 'success');
      return true;
    } catch {
      toast('测试失败', 'error');
      return false;
    }
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
    { key: 'methods', label: '转发方式', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { key: 'forwarding', label: '转发规则', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { key: 'trash', label: '垃圾箱规则', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
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
        <div className="px-6 py-5">

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
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
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
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
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
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ===== 左栏卡片：规则列表 ===== */}
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 space-y-5">
                  {/* 自动标记已读 */}
                  <div className="flex items-center justify-between">
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

                  {/* 统一规则列表 */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      验证码规则 <span className="text-xs text-gray-400 font-normal">（同时匹配主题和正文，支持正则）</span>
                    </p>
                    <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                      {/* 内置规则 */}
                      {builtinRules.map(rule => {
                        const isOff = disabledBuiltin.has(rule.id);
                        return (
                          <div key={rule.id}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${isOff ? 'opacity-40' : 'bg-blue-50/30'}`}>
                            <span className="text-[10px] px-1 py-0.5 rounded bg-gray-200 text-gray-500 flex-shrink-0">内置</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{RULE_TYPE_LABEL[rule.type]}</span>
                            <code className="text-xs text-gray-700 flex-1 truncate font-mono">{rule.value}</code>
                            <button onClick={() => handleToggleBuiltin(rule.id)}
                              className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${isOff ? 'text-gray-400 bg-gray-100' : 'text-green-600 bg-green-50'}`}>
                              {isOff ? '已关闭' : '已启用'}
                            </button>
                          </div>
                        );
                      })}
                      {/* 自定义规则 */}
                      {rules.map(rule => (
                        <div key={`custom_${rule.id}`}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white border border-gray-100">
                          <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 text-blue-600 flex-shrink-0">自定义</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{RULE_TYPE_LABEL[rule.type]}</span>
                          <code className="text-xs text-gray-700 flex-1 truncate font-mono">{rule.value}</code>
                          <button onClick={() => handleToggleRule(rule.id)}
                            className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${rule.enabled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                            {rule.enabled ? '启用' : '停用'}
                          </button>
                          <button onClick={() => handleDeleteRule(rule.id)}
                            className="text-xs px-1.5 py-0.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0">删除</button>
                        </div>
                      ))}
                      {builtinRules.length === 0 && rules.length === 0 && (
                        <p className="text-xs text-gray-400 py-2 text-center">暂无规则</p>
                      )}
                    </div>
                  </div>

                  {/* 添加规则按钮 */}
                  <div>
                    <button onClick={() => { setShowAddRule(true); setAddRuleType('subject_keyword'); setAddRuleValue(''); }}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                      + 添加规则
                    </button>
                  </div>

                  {/* 添加规则弹窗 */}
                  {showAddRule && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddRule(false)}>
                      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-5" onClick={e => e.stopPropagation()}>
                        <p className="text-sm font-medium text-gray-700 mb-4">添加验证码规则</p>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">类型</label>
                            <select value={addRuleType} onChange={e => setAddRuleType(e.target.value as any)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
                              <option value="subject_keyword">关键词</option>
                              <option value="sender_pattern">发件人匹配</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">规则内容</label>
                            <input type="text" value={addRuleValue}
                              onChange={e => setAddRuleValue(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && !addRuleLoading && handleAddRule()}
                              placeholder={addRuleType === 'subject_keyword' ? '例如: 安全码' : '例如: @example\\.com'}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-4">
                          <button onClick={() => setShowAddRule(false)}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">取消</button>
                          <button onClick={handleAddRule} disabled={addRuleLoading}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                            {addRuleLoading ? '添加中...' : '添加'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* ===== 右栏卡片：规则测试 ===== */}
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 space-y-4">
                  <p className="text-sm font-medium text-gray-700">规则测试</p>
                  <p className="text-xs text-gray-400">粘贴或选择邮件内容测试哪些规则会匹配。</p>

                  <div className="flex items-center gap-2">
                    <button onClick={() => handleOpenMailPicker()}
                      className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                      📩 选择邮件
                    </button>
                    <span className="text-xs text-gray-400">从收件箱选取邮件自动填入</span>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">发件人地址（可选）</label>
                    <input type="text" value={testFrom}
                      onChange={e => setTestFrom(e.target.value)}
                      placeholder="service@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">邮件主题</label>
                    <input type="text" value={testSubject}
                      onChange={e => setTestSubject(e.target.value)}
                      placeholder="您的验证码是 123456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">邮件正文</label>
                    <textarea value={testBody}
                      onChange={e => setTestBody(e.target.value)}
                      placeholder="验证码：123456，请勿泄露给他人"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-y" />
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={handleTestVerification} disabled={testLoading}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                      {testLoading ? '测试中...' : '测试匹配'}
                    </button>
                  </div>

                  {/* 匹配结果总览 */}
                  {testResult !== null && (
                    <div className={`rounded-lg px-4 py-3 ${testResult.matched ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                      {testResult.code ? (
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">识别到验证码</p>
                          <p className="text-2xl font-bold font-mono tracking-widest text-blue-600">{testResult.code}</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${testResult.matched ? 'text-green-600' : 'text-gray-400'}`}>
                            {testResult.matched ? '✓ 已有规则匹配' : '○ 无规则匹配'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 详细匹配结果 — 所有规则逐条显示 */}
                  {testResult !== null && (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
                      {testResult.rules.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-gray-400">无规则可测试</div>
                      ) : (
                        testResult.rules.map(r => (
                          <div key={r.id}
                            className={`flex items-center gap-2 px-3 py-2 text-xs ${r.matched ? 'bg-green-50/50' : r.enabled ? '' : 'opacity-40'}`}>
                            <span className={`flex-shrink-0 font-bold ${r.matched ? 'text-green-600' : 'text-gray-300'}`}>
                              {r.matched ? '✓' : '○'}
                            </span>
                            <span className={`px-1 py-0.5 rounded font-mono ${r.isBuiltin ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                              {r.isBuiltin ? '内置' : '自定义'}
                            </span>
                            <span className="text-gray-500 flex-shrink-0">{RULE_TYPE_LABEL[r.type] || r.type}</span>
                            <code className="text-gray-700 flex-1 truncate font-mono">{r.value}</code>
                            {!r.enabled && <span className="text-gray-400 flex-shrink-0">（已停用）</span>}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* 邮件选择弹窗 */}
                  {showMailPicker && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowMailPicker(false)}>
                      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-700">选择邮件</p>
                          <button onClick={() => setShowMailPicker(false)}
                            className="text-xs text-gray-400 hover:text-gray-600">关闭</button>
                        </div>
                        <div className="px-5 py-3 border-b border-gray-100">
                          <input type="text" value={mailListQuery}
                            onChange={e => handleSearchMails(e.target.value)}
                            placeholder="搜索主题或发件人..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex-1 overflow-y-auto min-h-0">
                          {mailListLoading ? (
                            <div className="px-5 py-8 text-center text-xs text-gray-400">加载中...</div>
                          ) : filteredMailList.length === 0 ? (
                            <div className="px-5 py-8 text-center text-xs text-gray-400">
                              {mailListQuery.trim() ? '无匹配邮件' : '暂无邮件'}
                            </div>
                          ) : (
                            filteredMailList.map(m => (
                              <button key={m.id} onClick={() => handleSelectMail(m.id)}
                                className="w-full text-left px-5 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm text-gray-800 truncate">{m.subject || '(无主题)'}</div>
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    <span>{m.fromName || m.fromAddress}</span>
                                    <span className="mx-1">·</span>
                                    <span>{new Date(m.receivedAt).toLocaleDateString('zh-CN')}</span>
                                    {m.verificationCode && <span className="ml-2 text-blue-500">验证码: {m.verificationCode}</span>}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                          <span>
                            {mailListQuery.trim()
                              ? `找到 ${filteredMailList.length} 封（共 ${mailListTotal} 封）`
                              : `共 ${mailListTotal} 封邮件（仅显示最近 100 封）`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

            </div>
          )}

          {/* 转发规则 */}
          {activeSection === 'forwarding' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 space-y-6">

                {/* ---- 转发规则列表 ---- */}
                <div>
                  <p className="text-xs text-gray-400 mb-3">同步新邮件时，匹配规则的邮件将按指定的转发方式自动处理。</p>
                  {forwardingRules.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">暂无转发规则</p>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {forwardingRules.map(rule => {
                        const cur = editingMethodId[rule.id] ?? rule.method_id ?? -1;
                        return (
                          <div key={rule.id}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0">{RULE_TYPE_LABEL[rule.type]}</span>
                            <code className="text-xs text-gray-700 flex-1 truncate font-mono">{rule.value}</code>
                            <select value={cur} onChange={e => handleUpdateRuleMethod(rule.id, parseInt(e.target.value))}
                              className="px-1.5 py-0.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 max-w-[120px] appearance-none bg-white pr-6 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2210%22%20height%3D%2210%22%20viewBox%3D%220%200%2010%2010%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M5%208L1%202h8z%22/%3E%3C/svg%3E')] bg-[length:10px] bg-[right_6px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
                              <option value={-1}>使用默认</option>
                              {forwardingMethods.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                            <button onClick={() => handleToggleForwardingRule(rule.id)}
                              className={`text-xs px-1.5 py-0.5 rounded ${rule.enabled ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                              {rule.enabled ? '启用' : '停用'}
                            </button>
                            <button onClick={() => handleDeleteForwardingRule(rule.id)}
                              className="text-xs text-red-400 hover:text-red-600 flex-shrink-0">删除</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <select value={newForwardingType} onChange={e => setNewForwardingType(e.target.value as any)}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
                      <option value="subject_keyword">主题关键词</option>
                      <option value="sender_pattern">发件人匹配</option>
                    </select>
                    <input type="text"
                      placeholder={newForwardingType === 'subject_keyword' ? '例如: 账单' : '例如: @newsletter\\.com'}
                      value={newForwardingValue}
                      onChange={e => setNewForwardingValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddForwardingRule()}
                      className="flex-1 min-w-[120px] px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <select value={newForwardingMethodId} onChange={e => setNewForwardingMethodId(parseInt(e.target.value))}
                      className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
                      <option value={-1}>使用默认转发方式</option>
                      {forwardingMethods.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <button onClick={handleAddForwardingRule}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                      添加
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">支持正则表达式，不区分大小写。添加后下次同步邮件时生效。</p>
                </div>

                <div className="border-t border-gray-100" />

                {/* ---- 验证码转发 ---- */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">验证码转发</p>
                      <p className="text-xs text-gray-400 mt-0.5">检测到验证码时自动通过启用的转发方式分发</p>
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
                    <div className="pl-2">
                      <p className="text-xs text-gray-400">验证码将通过「<strong>转发方式</strong>」页面中所有启用的方式分发（邮件、Server酱、企业微信、飞书）。</p>
                    </div>
                  )}
                </div>

              </div>
            </section>
          )}

          {/* 转发方式 */}
          {activeSection === 'methods' && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-4 space-y-4">

                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-400">配置邮件转发和处理的分发渠道。转发规则和验证码转发会按启用状态自动匹配使用。</p>
                  <button onClick={() => setShowAddMethod(true)}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0">
                    + 添加方式
                  </button>
                </div>

                {forwardingMethods.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">
                    <p>暂无转发方式</p>
                    <p className="text-xs mt-1">点击上方按钮添加</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {forwardingMethods.map(method => (
                      <MethodCard
                        key={method.id}
                        method={method}
                        onToggle={handleToggleMethod}
                        onUpdate={handleUpdateMethodInfo}
                        onSetDefault={handleSetDefaultMethod}
                        onDelete={handleDeleteMethod}
                        onTest={handleTestMethod}
                      />
                    ))}
                  </div>
                )}

                {/* 添加表单 — 弹出框，见页面底部 */}

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
                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
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

      {/* ===== 新建转发方式弹出框 ===== */}
      {showAddMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowAddMethod(false); setNewMethodName(''); setNewMethodTarget(''); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-800 mb-4">新建转发方式</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">类型</label>
                  <select value={newMethodType} onChange={e => setNewMethodType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 appearance-none bg-white pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M6%209L1%203h10z%22/%3E%3C/svg%3E')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat cursor-pointer hover:border-gray-400 transition-colors">
                    <option value="email">邮件转发</option>
                    <option value="serverchan">Server酱</option>
                    <option value="wecom_bot">企业微信群机器人</option>
                    <option value="feishu_bot">飞书群机器人</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">名称 <span className="text-gray-300 font-normal">（留空自动生成）</span></label>
                  <input type="text" value={newMethodName}
                    onChange={e => setNewMethodName(e.target.value)}
                    placeholder={METHOD_TYPE_LABEL[newMethodType]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {newMethodType === 'email' ? '目标邮箱' : newMethodType === 'serverchan' ? 'SendKey' : 'Webhook URL'}
                </label>
                <input type={newMethodType === 'serverchan' ? 'password' : 'text'}
                  value={newMethodTarget}
                  onChange={e => setNewMethodTarget(e.target.value)}
                  placeholder={newMethodType === 'email' ? 'forward@example.com' : newMethodType === 'serverchan' ? '在 Server酱 官网获取的 SendKey' : 'Webhook 地址'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => { setShowAddMethod(false); setNewMethodName(''); setNewMethodTarget(''); }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                  取消
                </button>
                <button onClick={handleAddMethod} disabled={addMethodLoading}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {addMethodLoading ? '添加中...' : '确认添加'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
