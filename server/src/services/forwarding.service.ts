import { getDatabase } from '../database';
import type { ForwardingRuleRow, AccountRow } from '../types';
import { getMethod, getDefaultMethod, getEnabledMethods } from './forwarding-method.service';
import { detectVerificationCode, sendMail, fetchMailBody } from './mail.service';
import { pushToWechat } from './serverchan.service';
import { pushToWecom } from './wecom.service';
import { pushToFeishu } from './feishu.service';

// ---------- CRUD ----------

export function getAllForwardingRules(): ForwardingRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_rules ORDER BY id').all() as ForwardingRuleRow[];
}

export function getEnabledForwardingRules(): ForwardingRuleRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM forwarding_rules WHERE enabled = 1 ORDER BY id').all() as ForwardingRuleRow[];
}

export function addForwardingRule(type: 'subject_keyword' | 'sender_pattern' | 'verification_code', value: string, methodId?: number): ForwardingRuleRow {
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
  methodName: string;
  /** 是否为验证码虚拟规则（非用户配置的转发规则，而是系统自动追加） */
  isVerificationCode?: boolean;
}

// 检测匹配的转发规则及其对应的方法（通用规则 + verification_code 内置规则）
export function getMatchedForwardTargets(subject: string, fromAddress: string, bodyText?: string): MatchedForwardTarget[] {
  const rules = getEnabledForwardingRules();
  const results: MatchedForwardTarget[] = [];

  for (const r of rules) {
    try {
      if (r.type === 'verification_code') {
        // 验证码规则：由 detectVerificationCode 判定是否匹配
        const code = detectVerificationCode(subject, bodyText || '', fromAddress);
        if (!code) continue;
      } else {
        // 主题关键词 / 发件人匹配规则：正则匹配
        const re = new RegExp(r.value, 'i');
        const matches = r.type === 'subject_keyword' ? re.test(subject) : re.test(fromAddress);
        if (!matches) continue;
      }

      // 确定使用哪个转发方法
      let methodId = r.method_id;
      let method = methodId ? getMethod(methodId) : null;
      if (!method) {
        method = getDefaultMethod();
      }
      // 兜底：既没有指定方法也没有默认方法时，使用第一个启用方法
      if (!method) {
        const enabledMethods = getEnabledMethods();
        if (enabledMethods.length > 0) {
          method = enabledMethods[0];
        }
      }
      if (!method) continue;

      results.push({
        ruleId: r.id,
        methodId: method.id,
        methodType: method.type,
        methodTarget: method.target,
        methodName: method.name,
        isVerificationCode: r.type === 'verification_code',
      });
    } catch { /* ignore */ }
  }
  return results;
}

/** 对一封新邮件执行转发（统一入口：通用规则 + 验证码规则） */
export async function executeForwarding(
  mail: { id: string; subject: string; body_text: string; body_html: string; from_name: string; from_address: string; account_id?: string; folder?: string; message_uid?: number },
  account: AccountRow,
): Promise<void> {
  const db = getDatabase();
  const insertLog = db.prepare('INSERT INTO mail_forward_log (mail_id, method_type, method_name, forwarded_at) VALUES (?, ?, ?, ?)');
  const now = new Date().toISOString();

  // 正文为空时从 IMAP 按需拉取（HTML-only 邮件 sync 时 body_text 可能为空）
  let bodyText = mail.body_text || '';
  if (!bodyText && mail.account_id && mail.folder && mail.message_uid) {
    try {
      const fetched = await fetchMailBody(account, mail.folder, mail.message_uid, mail.id);
      if (fetched) {
        bodyText = fetched.bodyText;
        // 回写数据库，避免下次再拉取
        db.prepare('UPDATE mails SET body_text = ?, body_html = ? WHERE id = ?').run(bodyText, fetched.bodyHtml, mail.id);
      }
    } catch (err) {
      console.error(`[Forward] 邮件 ${mail.id} 正文拉取失败:`, err);
    }
  }

  const targets = getMatchedForwardTargets(mail.subject, mail.from_address, bodyText);

  if (targets.length === 0) {
    console.log(`[Forward] 邮件 ${mail.id} 无匹配转发规则 (subject=${mail.subject}, bodyText长度=${bodyText.length})`);
    return;
  }

  // 获取验证码标题（如果有 VC 目标的话）
  const vcTarget = targets.find(t => t.isVerificationCode);
  const code = vcTarget ? detectVerificationCode(mail.subject, bodyText, mail.from_address) : '';
  const vcTitle = code ? `${mail.from_name} ${code}` : '';

  for (const t of targets) {
    try {
      if (t.isVerificationCode) {
        if (t.methodType === 'email') {
          await sendMail(account, {
            accountId: account.id, to: [t.methodTarget],
            subject: vcTitle, body: bodyText, isHtml: false,
          });
        } else if (t.methodType === 'serverchan') {
          await pushToWechat(vcTitle, bodyText, t.methodTarget);
        } else if (t.methodType === 'wecom_bot') {
          await pushToWecom(vcTitle, bodyText, t.methodTarget);
        } else if (t.methodType === 'feishu_bot') {
          await pushToFeishu(vcTitle, bodyText, t.methodTarget);
        }
      } else {
        if (t.methodType === 'email') {
          await sendMail(account, {
            accountId: account.id, to: [t.methodTarget],
            subject: `Fwd: ${mail.subject}`,
            body: `---------- 转发邮件 ----------\n发件人: ${mail.from_name} <${mail.from_address}>\n主题: ${mail.subject}\n\n${bodyText}`,
            isHtml: false,
          });
        } else if (t.methodType === 'serverchan') {
          await pushToWechat('邮件转发通知', `**${mail.from_name}** 的邮件已自动转发\n\n- **发件人**: ${mail.from_name} <${mail.from_address}>\n- **主题**: ${mail.subject}`, t.methodTarget);
        } else if (t.methodType === 'wecom_bot') {
          await pushToWecom('邮件转发通知', `**${mail.from_name}** 的邮件已自动转发\n\n- **发件人**: ${mail.from_name} <${mail.from_address}>\n- **主题**: ${mail.subject}`, t.methodTarget);
        } else if (t.methodType === 'feishu_bot') {
          await pushToFeishu('邮件转发通知', `**发件人**: ${mail.from_name} <${mail.from_address}>\n**主题**: ${mail.subject}`, t.methodTarget);
        }
      }
      insertLog.run(mail.id, t.methodType, t.methodName, now);
    } catch (forwardErr) {
      console.error(`[Forward] 转发邮件 ${mail.id} 失败:`, forwardErr);
    }
  }
}

/** 手动重试某封邮件的转发（把 forwarded 重置为 0，调用方需重新触发同步或再次调用 executeForwarding） */
export function resetForwardStatus(mailId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('UPDATE mails SET forwarded = 0 WHERE id = ?').run(mailId);
  return result.changes > 0;
}
