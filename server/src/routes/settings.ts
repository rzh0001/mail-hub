import { Router, Request, Response } from 'express';
import * as settingsService from '../services/settings.service';

const router = Router();

// 获取所有设置
router.get('/settings', (_req: Request, res: Response) => {
  const settings = settingsService.getAllSettings();
  res.json({ success: true, data: settings });
});

// 更新设置（批量）
router.put('/settings', (req: Request, res: Response) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ success: false, error: '请提供设置对象' });
      return;
    }
    const updated = settingsService.updateSettings(settings);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '更新设置失败' });
  }
});

export default router;
