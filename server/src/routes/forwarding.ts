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
    const { type, value, targetEmail } = req.body;
    if (!type || !value || !targetEmail) {
      res.status(400).json({ success: false, error: '请提供 type、value 和 targetEmail' });
      return;
    }
    if (!['subject_keyword', 'sender_pattern'].includes(type)) {
      res.status(400).json({ success: false, error: 'type 必须是 subject_keyword 或 sender_pattern' });
      return;
    }
    const rule = forwardingService.addForwardingRule(type, value.trim(), targetEmail);
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

export default router;
