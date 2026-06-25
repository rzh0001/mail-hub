import type { ApiResponse, MailAccount, MailProvider, MailSummary, MailDetail, MailListResponse, CreateAccountInput, SendMailInput, AccountConfig, ImportResult } from '../types';

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
