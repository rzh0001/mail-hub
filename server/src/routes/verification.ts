import { Router, Request, Response } from 'express';
import * as verificationService from '../services/verification.service';
import { getBuiltinRules, detectVerificationCode } from '../services/mail.service';
import * as settingsService from '../services/settings.service';
import { getDatabase } from '../database';

const router = Router();

// 获取所有规则
router.get('/verification-rules', (_req: Request, res: Response) => {
  const rules = verificationService.getAllRules();
  res.json({ success: true, data: rules });
});

// 获取内置规则列表
router.get('/verification-rules/builtin', (_req: Request, res: Response) => {
  const rules = getBuiltinRules();
  // 同时返回已关闭的内置规则 ID 列表
  const disabledRaw = settingsService.getSetting('disabled_builtin_rules');
  const disabled: string[] = disabledRaw ? JSON.parse(disabledRaw) : [];
  res.json({ success: true, data: { rules, disabled } });
});

// 更新已关闭的内置规则列表
router.put('/verification-rules/disabled-builtin', (req: Request, res: Response) => {
  try {
    const { disabled } = req.body;
    if (!Array.isArray(disabled)) {
      res.status(400).json({ success: false, error: 'disabled 必须是数组' });
      return;
    }
    settingsService.updateSetting('disabled_builtin_rules', JSON.stringify(disabled));
    res.json({ success: true, data: { disabled } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '操作失败' });
  }
});

// 添加规则
router.post('/verification-rules', (req: Request, res: Response) => {
  try {
    const { type, value } = req.body;
    if (!type || !value) {
      res.status(400).json({ success: false, error: '请提供 type 和 value' });
      return;
    }
    if (!['subject_keyword', 'sender_pattern'].includes(type)) {
      res.status(400).json({ success: false, error: 'type 必须是 subject_keyword 或 sender_pattern' });
      return;
    }
    const rule = verificationService.addRule(type, value.trim());
    res.json({ success: true, data: rule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '添加规则失败' });
  }
});

// 删除规则
router.delete('/verification-rules/:id', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: '无效的 ID' });
    return;
  }
  const deleted = verificationService.deleteRule(id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '规则不存在' });
  }
});

// 切换自定义规则启用状态
router.put('/verification-rules/:id/toggle', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: '无效的 ID' });
    return;
  }
  const rule = verificationService.toggleRule(id);
  if (rule) {
    res.json({ success: true, data: rule });
  } else {
    res.status(404).json({ success: false, error: '规则不存在' });
  }
});

// 测试验证码规则匹配
router.post('/verification-rules/test', (req: Request, res: Response) => {
  try {
    const { subject, bodyText, fromAddress } = req.body;
    if (!subject && !bodyText) {
      res.status(400).json({ success: false, error: '请至少提供邮件主题或正文' });
      return;
    }

    const subj = subject || '';
    const body = bodyText || '';
    const from = fromAddress || '';

    // 获取所有规则
    const db = getDatabase();
    const customRules = db.prepare('SELECT id, type, value, enabled FROM verification_rules').all() as { id: number; type: string; value: string; enabled: number }[];
    const builtinRules = getBuiltinRules();
    const disabledRaw = settingsService.getSetting('disabled_builtin_rules');
    const disabledBuiltin: string[] = disabledRaw ? JSON.parse(disabledRaw) : [];
    const disabledSet = new Set(disabledBuiltin);

    type MatchedRule = { id: string; type: 'subject_keyword' | 'sender_pattern' | 'extract_pattern'; value: string; isBuiltin: boolean; enabled: boolean; matched: boolean };
    const results: MatchedRule[] = [];

    // 测试内置规则
    for (const r of builtinRules) {
      const isDisabled = disabledSet.has(r.id);
      let matched = false;
      if (!isDisabled) {
        try {
          const re = new RegExp(r.value, 'i');
          if (r.type === 'subject_keyword') matched = re.test(subj + ' ' + body);
          else if (r.type === 'sender_pattern') matched = from ? re.test(from) : false;
          else if (r.type === 'extract_pattern') matched = re.test(subj + ' ' + body);
        } catch { /* 忽略无效正则 */ }
      }
      results.push({ id: r.id, type: r.type, value: r.value, isBuiltin: true, enabled: !isDisabled, matched });
    }

    // 测试自定义规则
    for (const r of customRules) {
      let matched = false;
      if (r.enabled) {
        try {
          const re = new RegExp(r.value, 'i');
          if (r.type === 'subject_keyword') matched = re.test(subj + ' ' + body);
          else if (r.type === 'sender_pattern') matched = from ? re.test(from) : false;
        } catch { /* 忽略无效正则 */ }
      }
      results.push({ id: `custom_${r.id}`, type: r.type as 'subject_keyword' | 'sender_pattern', value: r.value, isBuiltin: false, enabled: !!r.enabled, matched });
    }

    // 运行完整的检测逻辑
    const code = detectVerificationCode(subj, body, from);

    res.json({
      success: true,
      data: {
        matched: results.some(r => r.enabled && r.matched),
        code: code || null,
        rules: results,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '测试失败' });
  }
});

export default router;
