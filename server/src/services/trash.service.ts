import { getDatabase } from '../database';
import type { TrashRuleRow } from '../types';

// ---------- CRUD ----------

export function getAllTrashRules(): TrashRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM trash_rules ORDER BY id').all() as TrashRuleRow[];
}

export function getEnabledTrashRules(): TrashRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM trash_rules WHERE enabled = 1 ORDER BY id').all() as TrashRuleRow[];
}

export function addTrashRule(type: 'subject_keyword' | 'sender_pattern', value: string): TrashRuleRow {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare('INSERT INTO trash_rules (type, value, enabled, created_at) VALUES (?, ?, 1, ?)')
    .run(type, value.trim(), now);
  return db.prepare('SELECT * FROM trash_rules WHERE id = ?').get(result.lastInsertRowid) as TrashRuleRow;
}

export function deleteTrashRule(id: number): boolean {
  const db = getDatabase();
  return db.prepare('DELETE FROM trash_rules WHERE id = ?').run(id).changes > 0;
}

export function toggleTrashRule(id: number): TrashRuleRow | null {
  const db = getDatabase();
  const rule = db.prepare('SELECT * FROM trash_rules WHERE id = ?').get(id) as TrashRuleRow | undefined;
  if (!rule) return null;
  const newEnabled = rule.enabled ? 0 : 1;
  db.prepare('UPDATE trash_rules SET enabled = ? WHERE id = ?').run(newEnabled, id);
  return db.prepare('SELECT * FROM trash_rules WHERE id = ?').get(id) as TrashRuleRow;
}

// ---------- 检测逻辑 ----------

interface TrashRuleCheck {
  keywords: RegExp[];
  senders: RegExp[];
}

function loadTrashRules(): TrashRuleCheck {
  const rules = getEnabledTrashRules();
  const keywords: RegExp[] = [];
  const senders: RegExp[] = [];
  for (const r of rules) {
    try {
      const re = new RegExp(r.value, 'i');
      if (r.type === 'subject_keyword') keywords.push(re);
      else if (r.type === 'sender_pattern') senders.push(re);
    } catch { /* 忽略无效正则 */ }
  }
  return { keywords, senders };
}

// 检测邮件是否匹配垃圾箱规则
export function matchesTrashRule(subject: string, fromAddress: string): boolean {
  const rules = getEnabledTrashRules();
  for (const r of rules) {
    try {
      const re = new RegExp(r.value, 'i');
      if (r.type === 'subject_keyword' && re.test(subject)) return true;
      if (r.type === 'sender_pattern' && re.test(fromAddress)) return true;
    } catch { /* ignore */ }
  }
  return false;
}
