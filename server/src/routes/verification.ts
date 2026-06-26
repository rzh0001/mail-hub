import { Router, Request, Response } from 'express';
import * as verificationService from '../services/verification.service';
import { getBuiltinRules } from '../services/mail.service';
import * as settingsService from '../services/settings.service';

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

export default router;
