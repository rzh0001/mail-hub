import { Router, Request, Response } from 'express';
import * as draftService from '../services/draft.service';

const router = Router();

// 获取所有草稿
router.get('/drafts', (_req: Request, res: Response) => {
  try {
    const drafts = draftService.getAllDrafts();
    res.json({ success: true, data: drafts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取草稿列表失败' });
  }
});

// 获取单个草稿
router.get('/drafts/:id', (req: Request, res: Response) => {
  try {
    const draft = draftService.getDraft(String(req.params.id));
    if (draft) {
      res.json({ success: true, data: draft });
    } else {
      res.status(404).json({ success: false, error: '草稿不存在' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取草稿失败' });
  }
});

// 保存草稿（创建或更新）
router.post('/drafts', (req: Request, res: Response) => {
  try {
    const { id, accountId, to, cc, subject, body } = req.body;
    if (!accountId) {
      res.status(400).json({ success: false, error: '请选择发件邮箱' });
      return;
    }
    const draft = draftService.saveDraft({ id, accountId, to: to || '', cc: cc || '', subject: subject || '', body: body || '' });
    res.json({ success: true, data: draft });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '保存草稿失败' });
  }
});

// 删除草稿
router.delete('/drafts/:id', (req: Request, res: Response) => {
  try {
    draftService.deleteDraft(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '删除草稿失败' });
  }
});

export default router;
