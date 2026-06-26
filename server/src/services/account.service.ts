import { v4 as uuid } from 'uuid';
import { getDatabase } from '../database';
import { MAIL_PROVIDERS } from '../types';
import type { AccountRow, AccountDTO, CreateAccountInput, UpdateAccountInput } from '../types';

// 将数据库行转换为API响应
function toDTO(row: AccountRow): AccountDTO {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapSecure: row.imap_secure === 1,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure === 1,
    provider: row.provider,
    avatarColor: row.avatar_color || '',
    avatarName: row.avatar_name || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 创建邮箱账户
export function createAccount(input: CreateAccountInput): AccountDTO {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = uuid();

  // 如果指定了提供商，使用预配置
  let config = {
    imapHost: input.imapHost || '',
    imapPort: input.imapPort || 993,
    imapSecure: input.imapSecure !== undefined ? input.imapSecure : true,
    smtpHost: input.smtpHost || '',
    smtpPort: input.smtpPort || 465,
    smtpSecure: input.smtpSecure !== undefined ? input.smtpSecure : true,
    provider: input.provider || '',
  };

  if (input.provider && MAIL_PROVIDERS[input.provider]) {
    const p = MAIL_PROVIDERS[input.provider];
    config = {
      imapHost: p.imapHost,
      imapPort: p.imapPort,
      imapSecure: p.imapSecure,
      smtpHost: p.smtpHost,
      smtpPort: p.smtpPort,
      smtpSecure: p.smtpSecure,
      provider: input.provider,
    };
  }

  // 检查是否已存在
  const existing = db.prepare('SELECT id FROM accounts WHERE email = ?').get(input.email);
  if (existing) {
    // 更新已有账户
    db.prepare(`
      UPDATE accounts SET name = ?, imap_host = ?, imap_port = ?, imap_secure = ?,
        smtp_host = ?, smtp_port = ?, smtp_secure = ?, auth_code = ?, provider = ?,
        avatar_color = ?, avatar_name = ?, updated_at = ?
      WHERE email = ?
    `).run(
      input.name, config.imapHost, config.imapPort, config.imapSecure ? 1 : 0,
      config.smtpHost, config.smtpPort, config.smtpSecure ? 1 : 0,
      input.authCode, config.provider,
      input.avatarColor || '', input.avatarName || '', now, input.email
    );

    const row = db.prepare('SELECT * FROM accounts WHERE email = ?').get(input.email) as AccountRow;
    return toDTO(row);
  }

  // 创建新账户
  const row: AccountRow = {
    id,
    name: input.name,
    email: input.email,
    imap_host: config.imapHost,
    imap_port: config.imapPort,
    imap_secure: config.imapSecure ? 1 : 0,
    smtp_host: config.smtpHost,
    smtp_port: config.smtpPort,
    smtp_secure: config.smtpSecure ? 1 : 0,
    auth_code: input.authCode,
    provider: config.provider,
    avatar_color: input.avatarColor || '',
    avatar_name: input.avatarName || '',
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO accounts (id, name, email, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, auth_code, provider, avatar_color, avatar_name, created_at, updated_at)
    VALUES (@id, @name, @email, @imap_host, @imap_port, @imap_secure, @smtp_host, @smtp_port, @smtp_secure, @auth_code, @provider, @avatar_color, @avatar_name, @created_at, @updated_at)
  `).run(row);

  return toDTO(row);
}

// 获取所有账户
export function getAllAccounts(): AccountDTO[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as AccountRow[];
  return rows.map(toDTO);
}

// 获取所有账户原始行（含授权码，用于调度器）
export function getAllAccountRows(): AccountRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as AccountRow[];
}

// 获取单个账户
export function getAccountById(id: string): AccountDTO | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  return row ? toDTO(row) : null;
}

// 获取完整账户信息（含授权码）
export function getAccountRow(id: string): AccountRow | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  return row || null;
}

// 更新账户基本信息
export function updateAccount(id: string, input: UpdateAccountInput): AccountDTO | null {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  if (!existing) return null;

  const now = new Date().toISOString();
  const name = input.name !== undefined ? input.name : existing.name;
  const avatarColor = input.avatarColor !== undefined ? input.avatarColor : existing.avatar_color;
  const avatarName = input.avatarName !== undefined ? input.avatarName : existing.avatar_name;

  db.prepare(`
    UPDATE accounts SET name = ?, avatar_color = ?, avatar_name = ?, updated_at = ? WHERE id = ?
  `).run(name, avatarColor, avatarName, now, id);

  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow;
  return toDTO(updated);
}

// 删除账户
export function deleteAccount(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return result.changes > 0;
}

// 获取账户完整配置（含授权码）
export function getAccountConfig(id: string) {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as AccountRow | undefined;
  if (!row) return null;
  return {
    name: row.name,
    email: row.email,
    authCode: row.auth_code,
    provider: row.provider,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapSecure: row.imap_secure === 1,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure === 1,
    avatarColor: row.avatar_color || '',
    avatarName: row.avatar_name || '',
  };
}

// 导出所有账户配置（含授权码）
export function exportAllAccounts() {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC').all() as AccountRow[];
  return rows.map(r => ({
    name: r.name,
    email: r.email,
    authCode: r.auth_code,
    provider: r.provider,
    imapHost: r.imap_host,
    imapPort: r.imap_port,
    imapSecure: r.imap_secure === 1,
    smtpHost: r.smtp_host,
    smtpPort: r.smtp_port,
    smtpSecure: r.smtp_secure === 1,
    avatarColor: r.avatar_color || '',
    avatarName: r.avatar_name || '',
  }));
}

// 批量导入账户
export function importAccounts(accounts: CreateAccountInput[]): { success: number; failed: number; errors: string[] } {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const input of accounts) {
    try {
      if (!input.email || !input.authCode || !input.name) {
        failed++;
        errors.push(`${input.email || '未知'}: 缺少必填字段（名称、邮箱、授权码）`);
        continue;
      }
      createAccount(input);
      success++;
    } catch (err: any) {
      failed++;
      errors.push(`${input.email}: ${err.message}`);
    }
  }

  return { success, failed, errors };
}

// 获取已配置的提供商列表
export function getProviders() {
  return Object.entries(MAIL_PROVIDERS).map(([key, val]) => ({
    id: key,
    name: val.name,
    imapHost: val.imapHost,
    imapPort: val.imapPort,
    imapSecure: val.imapSecure,
    smtpHost: val.smtpHost,
    smtpPort: val.smtpPort,
    smtpSecure: val.smtpSecure,
    sentFolder: val.sentFolder,
    trashFolder: val.trashFolder,
  }));
}
