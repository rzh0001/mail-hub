import { getDatabase } from '../database';
import type { ForwardingRuleRow } from '../types';
import { getMethod, getDefaultMethod } from './forwarding-method.service';

// ---------- CRUD ----------

export function getAllForwardingRules(): ForwardingRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_rules ORDER BY id').all() as ForwardingRuleRow[];
}

export function getEnabledForwardingRules(): ForwardingRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_rules WHERE enabled = 1 ORDER BY id').all() as ForwardingRuleRow[];
}

export function addForwardingRule(type: 'subject_keyword' | 'sender_pattern', value: string, methodId?: number): ForwardingRuleRow {
  const db = getDatabase();
  const now = new Date().toISOString();
  const result = db.prepare('INSERT INTO forwarding_rules (type, value, target_email, method_id, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run(type, value.trim(), '', methodId || null, now);
  return db.prepare('SELECT * FROM forwarding_rules WHERE id = ?').get(result.lastInsertRowid) as ForwardingRuleRow;
}

export function updateForwardingRuleMethod(id: number, methodId: number | null): ForwardingRuleRow | null {
  const db = getDatabase();
  const rule = db.prepare('SELECT * FROM forwarding_rules WHERE id = ?').get(id) as ForwardingRuleRow | undefined;
  if (!rule) return null;
  db.prepare('UPDATE forwarding_rules SET method_id = ? WHERE id = ?').run(methodId, id);
  return db.prepare('SELECT * FROM forwarding_rules WHERE id = ?').get(id) as ForwardingRuleRow;
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

interface MatchedForwardTarget {
  ruleId: number;
  methodId: number | null;
  methodType: string;
  methodTarget: string;
}

// 检测匹配的转发规则及其对应的方法
export function getMatchedForwardTargets(subject: string, fromAddress: string): MatchedForwardTarget[] {
  const rules = getEnabledForwardingRules();
  const results: MatchedForwardTarget[] = [];

  for (const r of rules) {
    try {
      const re = new RegExp(r.value, 'i');
      const matches = r.type === 'subject_keyword' ? re.test(subject) : re.test(fromAddress);
      if (!matches) continue;

      // 确定使用哪个转发方法
      let methodId = r.method_id;
      let method = methodId ? getMethod(methodId) : null;
      if (!method) {
        method = getDefaultMethod();
      }
      if (!method) continue;

      results.push({
        ruleId: r.id,
        methodId: method.id,
        methodType: method.type,
        methodTarget: method.target,
      });
    } catch { /* ignore */ }
  }
  return results;
}
