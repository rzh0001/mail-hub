import type { ApiResponse, MailAccount, MailProvider, MailSummary, MailDetail, MailListResponse, CreateAccountInput, UpdateAccountInput, SendMailInput, AccountConfig, ImportResult, SettingsMap, VerificationRule, BuiltinVerificationRule, ForwardingRule, ForwardingMethod, Draft, TrashRule } from '../types';

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
export function getMails(params?: { accountId?: string; folder?: string; page?: number; pageSize?: number; q?: string }): Promise<MailListResponse> {
  const q = new URLSearchParams();
  if (params?.accountId) q.set('accountId', params.accountId);
  if (params?.folder) q.set('folder', params.folder);
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('pageSize', String(params.pageSize));
  if (params?.q) q.set('q', params.q);
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

// 搜索邮件
export function searchMails(q: string): Promise<Array<{ id: string; subject: string; fromName: string; fromAddress: string; receivedAt: string }>> {
  return request(`/mails/search?q=${encodeURIComponent(q)}`);
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

// 测试验证码规则匹配
export function testVerificationRules(data: { subject: string; bodyText: string; fromAddress?: string }): Promise<{
  matched: boolean;
  code: string | null;
  rules: Array<{ id: string; type: string; value: string; isBuiltin: boolean; enabled: boolean; matched: boolean }>;
}> {
  return request('/verification-rules/test', { method: 'POST', body: JSON.stringify(data) });
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
export function addForwardingRule(type: 'subject_keyword' | 'sender_pattern' | 'verification_code', value: string, methodId?: number): Promise<ForwardingRule> {
  return request('/forwarding-rules', {
    method: 'POST',
    body: JSON.stringify({ type, value, methodId }),
  });
}

// 更新转发规则关联的方法
export function updateForwardingRuleMethod(id: number, methodId: number | null): Promise<ForwardingRule> {
  return request(`/forwarding-rules/${id}/method`, {
    method: 'PUT',
    body: JSON.stringify({ methodId }),
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

// ====== 草稿 ======

// 获取所有草稿
export function getDrafts(): Promise<Draft[]> {
  return request('/drafts');
}

// 获取单个草稿
export function getDraft(id: string): Promise<Draft> {
  return request(`/drafts/${id}`);
}

// 保存草稿（创建或更新）
export function saveDraft(data: { id?: string; accountId: string; to: string; cc: string; subject: string; body: string }): Promise<Draft> {
  return request('/drafts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 删除草稿
export function deleteDraft(id: string): Promise<void> {
  return request(`/drafts/${id}`, { method: 'DELETE' });
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

// ====== 转发方式 ======

// 获取所有转发方式
export function getForwardingMethods(): Promise<ForwardingMethod[]> {
  return request('/forwarding-methods');
}

// 创建转发方式
export function addForwardingMethod(type: string, name?: string, target?: string): Promise<ForwardingMethod> {
  return request('/forwarding-methods', {
    method: 'POST',
    body: JSON.stringify({ type, name, target }),
  });
}

// 更新转发方式
export function updateForwardingMethod(id: number, data: { name?: string; target?: string; enabled?: boolean }): Promise<ForwardingMethod> {
  return request(`/forwarding-methods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 删除转发方式
export function deleteForwardingMethod(id: number): Promise<void> {
  return request(`/forwarding-methods/${id}`, { method: 'DELETE' });
}

// 设置默认转发方式
export function setDefaultForwardingMethod(id: number): Promise<ForwardingMethod> {
  return request(`/forwarding-methods/${id}/default`, { method: 'POST' });
}

// ====== 账号注册（网站管理 + 随机分配） ======

export interface Website {
  id: number;
  domain: string;
  registeredCount: number;
  totalAccounts: number;
  createdAt: string;
}

export interface AssignedResult {
  accountId: string;
  email: string;
  accountName: string;
  domain: string;
  registeredCount: number;
  totalAccounts: number;
}

export interface WebsiteMail {
  id: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
  verificationCode: string;
  bodyText: string;
  bodyHtml: string;
}

/** 获取所有网站 */
export function getWebsites(): Promise<Website[]> {
  return request('/websites');
}

/** 添加网站域名 */
export function addWebsite(domain: string): Promise<Website> {
  return request('/websites', {
    method: 'POST',
    body: JSON.stringify({ domain }),
  });
}

/** 删除网站 */
export function deleteWebsite(id: number): Promise<void> {
  return request(`/websites/${id}`, { method: 'DELETE' });
}

/** 获取未注册某网站的邮箱列表 */
export function getUnregisteredAccounts(websiteId: number): Promise<Array<{ id: string; email: string; name: string }>> {
  return request(`/websites/${websiteId}/unregistered`);
}

/** 随机分配一个未注册的邮箱 */
export function assignEmail(websiteId: number): Promise<AssignedResult | null> {
  return request(`/websites/${websiteId}/assign`, { method: 'POST' });
}

/** 手动注册：将指定邮箱注册到某网站 */
export function registerEmail(websiteId: number, accountId: string): Promise<void> {
  return request(`/websites/${websiteId}/register`, {
    method: 'POST',
    body: JSON.stringify({ accountId }),
  });
}

/** 取消注册 */
export function unregisterEmail(websiteId: number, accountId: string): Promise<void> {
  return request(`/websites/${websiteId}/register/${accountId}`, { method: 'DELETE' });
}

/** 获取某网站的注册列表 */
export function getRegistries(websiteId: number): Promise<Array<{ id: number; accountId: string; accountEmail: string; accountName: string; websiteId: number; createdAt: string }>> {
  return request(`/websites/${websiteId}/registries`);
}

/** 获取某网站发给某邮箱的最新邮件 */
export function getWebsiteMails(websiteId: number, accountId: string, since?: string): Promise<WebsiteMail[]> {
  const params = new URLSearchParams({ accountId });
  if (since) params.set('since', since);
  return request(`/websites/${websiteId}/mails?${params.toString()}`);
}

// ====== Server酱 微信推送 ======

// 测试 Server酱 推送连通性
export function testServerChan(sendKey: string): Promise<{ sent: boolean }> {
  return request('/serverchan/test', { method: 'POST', body: JSON.stringify({ sendKey }) });
}

// 测试企业微信机器人连通性
export function testWecomBot(webhookUrl: string): Promise<{ sent: boolean }> {
  return request('/wecom-bot/test', { method: 'POST', body: JSON.stringify({ webhookUrl }) });
}

// 测试飞书机器人连通性
export function testFeishuBot(webhookUrl: string): Promise<{ sent: boolean }> {
  return request('/feishu-bot/test', { method: 'POST', body: JSON.stringify({ webhookUrl }) });
}
