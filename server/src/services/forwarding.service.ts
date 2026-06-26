import { getDatabase } from '../database';
import type { ForwardingRuleRow } from '../types';

// ---------- CRUD ----------

export function getAllForwardingRules(): ForwardingRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_rules ORDER BY id').all() as ForwardingRuleRow[];
}

export function getEnabledForwardingRules(): ForwardingRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_rules WHERE enabled = 1 ORDER BY id').all() as ForwardingRuleRow[];
}

export function addForwardingRule(type: 'subject_keyword' | 'sender_pattern', value: string, targetEmail: string): ForwardingRuleRow {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare('INSERT INTO forwarding_rules (type, value, target_email, enabled, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(type, value.trim(), targetEmail.trim(), now);
  return db.prepare('SELECT * FROM forwarding_rules WHERE id = ?').get(result.lastInsertRowid) as ForwardingRuleRow;
}

export function deleteForwardingRule(id: number): boolean {
  const db = getDatabase();
  return db.prepare('DELETE FROM forwarding_rules WHERE id = ?').run(id).changes > 0;
}

export function toggleForwardingRule(id: number): ForwardingRuleRow | null {
  const db = getDatabase();
  const rule = db.prepare('SELECT * FROM forwarding_rules WHERE id = ?').get(id) as ForwardingRuleRow | undefined;
  if (!rule) return null;
  const newEnabled = rule.enabled ? 0 : 1;
  db.prepare('UPDATE forwarding_rules SET enabled = ? WHERE id = ?').run(newEnabled, id);
  return db.prepare('SELECT * FROM forwarding_rules WHERE id = ?').get(id) as ForwardingRuleRow;
}

// ---------- 转发逻辑 ----------

// 检测是否匹配转发规则，返回要转发到的邮箱列表
export function getForwardTargets(subject: string, fromAddress: string): string[] {
  const rules = getEnabledForwardingRules();
  const matched: string[] = [];
  for (const r of rules) {
    try {
      const re = new RegExp(r.value, 'i');
      const matches = r.type === 'subject_keyword' ? re.test(subject) : re.test(fromAddress);
      if (matches && !matched.includes(r.target_email)) {
        matched.push(r.target_email);
      }
    } catch { /* ignore */ }
  }
  return matched;
}
