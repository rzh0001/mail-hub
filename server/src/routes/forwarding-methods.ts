import { Router, Request, Response } from 'express';
import * as forwardingMethodService from '../services/forwarding-method.service';

const router = Router();

const VALID_TYPES = ['email', 'serverchan', 'wecom_bot', 'feishu_bot'];

// 获取所有转发方式
router.get('/forwarding-methods', (_req: Request, res: Response) => {
  const methods = forwardingMethodService.getAllMethods();
  res.json({ success: true, data: methods });
});

// 获取启用的转发方式
router.get('/forwarding-methods/enabled', (_req: Request, res: Response) => {
  const methods = forwardingMethodService.getEnabledMethods();
  res.json({ success: true, data: methods });
});

// 创建转发方式
router.post('/forwarding-methods', (req: Request, res: Response) => {
  try {
    const { type, name, target } = req.body;
    if (!type || !VALID_TYPES.includes(type)) {
      res.status(400).json({ success: false, error: '请提供有效的转发方式类型' });
      return;
    }
    const method = forwardingMethodService.addMethod(type, name, target || '');
    res.json({ success: true, data: method });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '创建失败' });
  }
});

// 更新转发方式
router.put('/forwarding-methods/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ success: false, error: '无效的 ID' }); return; }
    const method = forwardingMethodService.updateMethod(id, req.body);
    if (!method) { res.status(404).json({ success: false, error: '转发方式不存在' }); return; }
    res.json({ success: true, data: method });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '更新失败' });
  }
});

// 删除转发方式
router.delete('/forwarding-methods/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ success: false, error: '无效的 ID' }); return; }
    const deleted = forwardingMethodService.deleteMethod(id);
    if (!deleted) { res.status(404).json({ success: false, error: '转发方式不存在' }); return; }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '删除失败' });
  }
});

// 设为默认
router.post('/forwarding-methods/:id/default', (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ success: false, error: '无效的 ID' }); return; }
    const method = forwardingMethodService.setDefaultMethod(id);
    if (!method) { res.status(404).json({ success: false, error: '转发方式不存在' }); return; }
    res.json({ success: true, data: method });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '设置默认失败' });
  }
});

export default router;
