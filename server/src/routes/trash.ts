import { Router, Request, Response } from 'express';
import * as trashService from '../services/trash.service';

const router = Router();

// 获取所有垃圾箱规则
router.get('/trash-rules', (_req: Request, res: Response) => {
  const rules = trashService.getAllTrashRules();
  res.json({ success: true, data: rules });
});

// 添加垃圾箱规则
router.post('/trash-rules', (req: Request, res: Response) => {
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
    const rule = trashService.addTrashRule(type, value.trim());
    res.json({ success: true, data: rule });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '添加垃圾箱规则失败' });
  }
});

// 删除垃圾箱规则
router.delete('/trash-rules/:id', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: '无效的 ID' });
    return;
  }
  const deleted = trashService.deleteTrashRule(id);
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '规则不存在' });
  }
});

// 切换垃圾箱规则启用状态
router.put('/trash-rules/:id/toggle', (req: Request, res: Response) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: '无效的 ID' });
    return;
  }
  const rule = trashService.toggleTrashRule(id);
  if (rule) {
    res.json({ success: true, data: rule });
  } else {
    res.status(404).json({ success: false, error: '规则不存在' });
  }
});

export default router;
