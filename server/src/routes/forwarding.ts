import { Router, Request, Response } from 'express';
import * as forwardingService from '../services/forwarding.service';

const router = Router();

// 获取所有转发规则
router.get('/forwarding-rules', (_req: Request, res: Response) => {
  const rules = forwardingService.getAllForwardingRules();
  res.json({ success: true, data: rules });
});

// 添加转发规则
router.post('/forwarding-rules', (req: Request, res: Response) => {
  try {
    const { type, value, methodId } = req.body;
    if (!type) {
      res.status(400).json({ success: false, error: '请提供 type' });
      return;
    }
    if (!['subject_keyword', 'sender_pattern', 'verification_code'].includes(type)) {
      res.status(400).json({ success: false, error: 'type 必须是 subject_keyword、sender_pattern 或 verification_code' });
      return;
    }
    if (type !== 'verification_code' && !value) {
      res.status(400).json({ success: false, error: '请提供规则内容' });
      return;
    }
    const rule = forwardingService.addForwardingRule(type, (value || '').trim(), methodId ? parseInt(methodId) : undefined);
    res.json({ success: true, data: rule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '添加转发规则失败' });
  }
});

// 删除转发规则
router.delete('/forwarding-rules/:id', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: '无效的 ID' });
    return;
  }
  const deleted = forwardingService.deleteForwardingRule(id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '规则不存在' });
  }
});

// 切换转发规则启用状态
router.put('/forwarding-rules/:id/toggle', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: '无效的 ID' });
    return;
  }
  const rule = forwardingService.toggleForwardingRule(id);
  if (rule) {
    res.json({ success: true, data: rule });
  } else {
    res.status(404).json({ success: false, error: '规则不存在' });
  }
});

// 更新转发规则的方法
router.put('/forwarding-rules/:id/method', (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ success: false, error: '无效的 ID' }); return; }
    const { methodId } = req.body;
    const rule = forwardingService.updateForwardingRuleMethod(id, methodId ? parseInt(methodId) : null);
    if (!rule) { res.status(404).json({ success: false, error: '规则不存在' }); return; }
    res.json({ success: true, data: rule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '更新失败' });
  }
});

export default router;
