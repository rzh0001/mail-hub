import { getDatabase } from '../database';

export interface VerificationRuleRow {
  id: number;
  type: 'subject_keyword';
  value: string;
  enabled: number;
  created_at: string;
}

// 获取所有启用的规则
export function getEnabledRules(): VerificationRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM verification_rules WHERE enabled = 1 ORDER BY id').all() as VerificationRuleRow[];
}

// 获取所有规则
export function getAllRules(): VerificationRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM verification_rules ORDER BY id').all() as VerificationRuleRow[];
}

// 添加规则
export function addRule(type: 'subject_keyword', value: string): VerificationRuleRow {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare('INSERT INTO verification_rules (type, value, enabled, created_at) VALUES (?, ?, 1, ?)').run(type, value, now);
  return db.prepare('SELECT * FROM verification_rules WHERE id = ?').get(result.lastInsertRowid) as VerificationRuleRow;
}

// 删除规则
export function deleteRule(id: number): boolean {
  const db = getDatabase();
  return db.prepare('DELETE FROM verification_rules WHERE id = ?').run(id).changes > 0;
}

// 切换启用状态
export function toggleRule(id: number): VerificationRuleRow | null {
  const db = getDatabase();
  const rule = db.prepare('SELECT * FROM verification_rules WHERE id = ?').get(id) as VerificationRuleRow | undefined;
  if (!rule) return null;
  const newEnabled = rule.enabled ? 0 : 1;
  db.prepare('UPDATE verification_rules SET enabled = ? WHERE id = ?').run(newEnabled, id);
  return db.prepare('SELECT * FROM verification_rules WHERE id = ?').get(id) as VerificationRuleRow;
}
