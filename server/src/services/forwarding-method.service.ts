import { getDatabase } from '../database';

const TYPE_DEFAULT_NAMES: Record<string, string> = {
  email: '邮件转发',
  serverchan: 'Server酱推送',
  wecom_bot: '企业微信推送',
  feishu_bot: '飞书推送',
};

export interface ForwardingMethodRow {
  id: number;
  type: 'email' | 'serverchan' | 'wecom_bot' | 'feishu_bot';
  name: string;
  target: string;
  enabled: number;
  is_default: number;
  created_at: string;
}

function generateName(type: string, name?: string): string {
  return (name && name.trim()) ? name.trim() : (TYPE_DEFAULT_NAMES[type] || type);
}

export function getAllMethods(): ForwardingMethodRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_methods ORDER BY id').all() as ForwardingMethodRow[];
}

export function getEnabledMethods(): ForwardingMethodRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_methods WHERE enabled = 1 ORDER BY id').all() as ForwardingMethodRow[];
}

export function getDefaultMethod(): ForwardingMethodRow | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM forwarding_methods WHERE is_default = 1').get() as ForwardingMethodRow | undefined;
  return row || null;
}

export function getMethod(id: number): ForwardingMethodRow | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM forwarding_methods WHERE id = ?').get(id) as ForwardingMethodRow | undefined;
  return row || null;
}

export function addMethod(type: 'email' | 'serverchan' | 'wecom_bot' | 'feishu_bot', name: string, target: string): ForwardingMethodRow {
  const db = getDatabase();
  const now = new Date().toISOString();
  const finalName = generateName(type, name);
  const result = db.prepare('INSERT INTO forwarding_methods (type, name, target, enabled, is_default, created_at) VALUES (?, ?, ?, 1, 0, ?)').run(type, finalName, target.trim(), now);
  return db.prepare('SELECT * FROM forwarding_methods WHERE id = ?').get(result.lastInsertRowid) as ForwardingMethodRow;
}

export function updateMethod(id: number, data: { name?: string; target?: string; enabled?: boolean }): ForwardingMethodRow | null {
  const db = getDatabase();
  const method = getMethod(id);
  if (!method) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(generateName(method.type, data.name)); }
  if (data.target !== undefined) { fields.push('target = ?'); values.push(data.target.trim()); }
  if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0); }

  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE forwarding_methods SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  return getMethod(id);
}

export function setDefaultMethod(id: number): ForwardingMethodRow | null {
  const db = getDatabase();
  const method = getMethod(id);
  if (!method) return null;

  const tx = db.transaction(() => {
    db.prepare('UPDATE forwarding_methods SET is_default = 0').run();
    db.prepare('UPDATE forwarding_methods SET is_default = 1 WHERE id = ?').run(id);
  });
  tx();
  return getMethod(id);
}

export function deleteMethod(id: number): boolean {
  const db = getDatabase();
  return db.prepare('DELETE FROM forwarding_methods WHERE id = ?').run(id).changes > 0;
}
