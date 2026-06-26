import type { ApiResponse, MailAccount, MailProvider, MailSummary, MailDetail, MailListResponse, CreateAccountInput, UpdateAccountInput, SendMailInput, AccountConfig, ImportResult, SettingsMap, VerificationRule, BuiltinVerificationRule, ForwardingRule, TrashRule } from '../types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.error || '请求失败');
  }
  return json.data as T;
}

// 获取提供商列表
export function getProviders(): Promise<MailProvider[]> {
  return request('/providers');
}

// 获取账户列表
export function getAccounts(): Promise<MailAccount[]> {
  return request('/accounts');
}

// 添加账户
export function createAccount(input: CreateAccountInput): Promise<MailAccount> {
  return request('/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// 更新账户基本信息
export function updateAccount(id: string, input: UpdateAccountInput): Promise<MailAccount> {
  return request(`/accounts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// 删除账户
export function deleteAccount(id: string): Promise<void> {
  return request(`/accounts/${id}`, { method: 'DELETE' });
}

// 测试连接
export function testAccount(id: string): Promise<{ connected: boolean }> {
  return request(`/accounts/${id}/test`, { method: 'POST' });
}

// 同步邮件
export function syncAccount(id: string, folder?: string, maxCount?: number): Promise<{ synced: number }> {
  return request(`/accounts/${id}/sync`, {
    method: 'POST',
    body: JSON.stringify({ folder: folder || 'INBOX', maxCount: maxCount || 50 }),
  });
}

// 获取邮件列表
export function getMails(params?: { accountId?: string; folder?: string; page?: number; pageSize?: number }): Promise<MailListResponse> {
  const q = new URLSearchParams();
  if (params?.accountId) q.set('accountId', params.accountId);
  if (params?.folder) q.set('folder', params.folder);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  const qs = q.toString();
  return request(`/mails${qs ? `?${qs}` : ''}`);
}

// 获取邮件详情
export function getMail(id: string): Promise<MailDetail> {
  return request(`/mails/${id}`);
}

// 标记已读
export function markRead(id: string, isRead: boolean): Promise<void> {
  return request(`/mails/${id}/read`, {
    method: 'PUT',
    body: JSON.stringify({ isRead }),
  });
}

// 标记星标
export function markFlagged(id: string, isFlagged: boolean): Promise<void> {
  return request(`/mails/${id}/flag`, {
    method: 'PUT',
    body: JSON.stringify({ isFlagged }),
  });
}

// 删除邮件
export function deleteMail(id: string): Promise<void> {
  return request(`/mails/${id}`, { method: 'DELETE' });
}

// 获取账户完整配置
export function getAccountConfig(id: string): Promise<AccountConfig> {
  return request(`/accounts/${id}/config`);
}

// 导出所有账户配置
export function exportAccounts(): Promise<AccountConfig[]> {
  return request('/accounts/export');
}

// 批量导入账户
export function importAccounts(accounts: CreateAccountInput[]): Promise<ImportResult> {
  return request('/accounts/import', {
    method: 'POST',
    body: JSON.stringify({ accounts }),
  });
}

// 全部标记已读
export function markAllRead(accountId?: string): Promise<{ count: number }> {
  const q = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  return request(`/mails/read-all${q}`, { method: 'PUT' });
}

// 批量标记已读
export function batchMarkRead(ids: string[]): Promise<{ count: number }> {
  return request('/mails/batch/read', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

// 批量删除
export function batchDeleteMails(ids: string[]): Promise<{ count: number }> {
  return request('/mails/batch/delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

// 发送邮件
export function sendMail(input: SendMailInput): Promise<void> {
  return request('/mails/send', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// 获取系统设置
export function getSettings(): Promise<SettingsMap> {
  return request('/settings');
}

// 更新系统设置
export function updateSettings(settings: SettingsMap): Promise<SettingsMap> {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// 获取验证码识别规则
export function getVerificationRules(): Promise<VerificationRule[]> {
  return request('/verification-rules');
}

// 添加验证码识别规则
export function addVerificationRule(type: 'subject_keyword' | 'sender_pattern', value: string): Promise<VerificationRule> {
  return request('/verification-rules', {
    method: 'POST',
    body: JSON.stringify({ type, value }),
  });
}

// 删除验证码识别规则
export function deleteVerificationRule(id: number): Promise<void> {
  return request(`/verification-rules/${id}`, { method: 'DELETE' });
}

// 切换验证码识别规则启用状态
export function toggleVerificationRule(id: number): Promise<VerificationRule> {
  return request(`/verification-rules/${id}/toggle`, { method: 'PUT' });
}

// 获取内置规则 + 已关闭列表
export function getBuiltinVerificationRules(): Promise<{ rules: BuiltinVerificationRule[]; disabled: string[] }> {
  return request('/verification-rules/builtin');
}

// 更新已关闭的内置规则列表
export function updateDisabledBuiltinRules(disabled: string[]): Promise<{ disabled: string[] }> {
  return request('/verification-rules/disabled-builtin', {
    method: 'PUT',
    body: JSON.stringify({ disabled }),
  });
}

// ====== 转发规则 ======

// 获取所有转发规则
export function getForwardingRules(): Promise<ForwardingRule[]> {
  return request('/forwarding-rules');
}

// 添加转发规则
export function addForwardingRule(type: 'subject_keyword' | 'sender_pattern', value: string, targetEmail: string): Promise<ForwardingRule> {
  return request('/forwarding-rules', {
    method: 'POST',
    body: JSON.stringify({ type, value, targetEmail }),
  });
}

// 删除转发规则
export function deleteForwardingRule(id: number): Promise<void> {
  return request(`/forwarding-rules/${id}`, { method: 'DELETE' });
}

// 切换转发规则启用状态
export function toggleForwardingRule(id: number): Promise<ForwardingRule> {
  return request(`/forwarding-rules/${id}/toggle`, { method: 'PUT' });
}

// ====== 垃圾箱规则 ======

// 获取所有垃圾箱规则
export function getTrashRules(): Promise<TrashRule[]> {
  return request('/trash-rules');
}

// 添加垃圾箱规则
export function addTrashRule(type: 'subject_keyword' | 'sender_pattern', value: string): Promise<TrashRule> {
  return request('/trash-rules', {
    method: 'POST',
    body: JSON.stringify({ type, value }),
  });
}

// 删除垃圾箱规则
export function deleteTrashRule(id: number): Promise<void> {
  return request(`/trash-rules/${id}`, { method: 'DELETE' });
}

// 切换垃圾箱规则启用状态
export function toggleTrashRule(id: number): Promise<TrashRule> {
  return request(`/trash-rules/${id}/toggle`, { method: 'PUT' });
}

// ====== 认证 ======

// 验证密码
export function verifyPassword(password: string): Promise<{ verified: boolean }> {
  return request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

// 修改密码
export function changePassword(oldPassword: string, newPassword: string): Promise<{ changed: boolean }> {
  return request('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}
