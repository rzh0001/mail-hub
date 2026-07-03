import { v4 as uuid } from 'uuid';
import { getDatabase } from '../database';

export interface DraftRow {
  id: string;
  account_id: string;
  to_list: string;
  cc_list: string;
  subject: string;
  body_html: string;
  created_at: string;
  updated_at: string;
}

export interface DraftDTO {
  id: string;
  accountId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

function toDTO(row: DraftRow): DraftDTO {
  return {
    id: row.id,
    accountId: row.account_id,
    to: row.to_list,
    cc: row.cc_list,
    subject: row.subject,
    body: row.body_html,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// 获取所有草稿
export function getAllDrafts(): DraftDTO[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM drafts ORDER BY updated_at DESC').all() as DraftRow[];
  return rows.map(toDTO);
}

// 获取单个草稿
export function getDraft(id: string): DraftDTO | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as DraftRow | undefined;
  return row ? toDTO(row) : null;
}

// 保存草稿（创建或更新）
export function saveDraft(data: {
  id?: string;
  accountId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
}): DraftDTO {
  const db = getDatabase();
  const now = new Date().toISOString();

  if (data.id) {
    // 更新已有草稿
    const existing = db.prepare('SELECT * FROM drafts WHERE id = ?').get(data.id) as DraftRow | undefined;
    if (existing) {
      db.prepare(`
        UPDATE drafts SET account_id = ?, to_list = ?, cc_list = ?, subject = ?, body_html = ?, updated_at = ?
        WHERE id = ?
      `).run(data.accountId, data.to, data.cc, data.subject, data.body, now, data.id);
      return toDTO(db.prepare('SELECT * FROM drafts WHERE id = ?').get(data.id) as DraftRow);
    }
  }

  // 创建新草稿
  const id = data.id || uuid();
  db.prepare(`
    INSERT INTO drafts (id, account_id, to_list, cc_list, subject, body_html, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.accountId, data.to, data.cc, data.subject, data.body, now, now);

  return toDTO(db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as DraftRow);
}

// 删除草稿
export function deleteDraft(id: string): boolean {
  const db = getDatabase();
  return db.prepare('DELETE FROM drafts WHERE id = ?').run(id).changes > 0;
}
