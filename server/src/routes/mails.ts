import { Router, Request, Response } from 'express';
import * as mailService from '../services/mail.service';
import * as accountService from '../services/account.service';
import type { SendMailInput } from '../types';

const router = Router();

// 获取邮件列表
router.get('/mails', (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const folder = req.query.folder as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = mailService.getMailList(accountId, folder, page, pageSize);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取邮件列表失败' });
  }
});

// 全部标记已读
router.put('/mails/read-all', (req: Request, res: Response) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const count = mailService.markAllRead(accountId);
    res.json({ success: true, data: { count } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '操作失败' });
  }
});

// 批量标记已读
router.put('/mails/batch/read', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: '请提供邮件ID列表' });
      return;
    }
    mailService.batchMarkRead(ids);
    res.json({ success: true, data: { count: ids.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '批量操作失败' });
  }
});

// 批量删除
router.post('/mails/batch/delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: '请提供邮件ID列表' });
      return;
    }
    mailService.batchMarkDeleted(ids);
    res.json({ success: true, data: { count: ids.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '批量操作失败' });
  }
});

// 获取邮件详情
router.get('/mails/:id', (req: Request, res: Response) => {
  try {
    const mail = mailService.getMailDetail(String(req.params.id));
    if (mail) {
      res.json({ success: true, data: mail });
    } else {
      res.status(404).json({ success: false, error: '邮件不存在' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取邮件详情失败' });
  }
});

// 删除邮件
router.delete('/mails/:id', (req: Request, res: Response) => {
  try {
    mailService.markDeleted(String(req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '删除邮件失败' });
  }
});

// 标记已读/未读
router.put('/mails/:id/read', (req: Request, res: Response) => {
  try {
    const isRead = req.body.isRead === true;
    mailService.markRead(String(req.params.id), isRead);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '操作失败' });
  }
});

// 标记星标
router.put('/mails/:id/flag', (req: Request, res: Response) => {
  try {
    const isFlagged = req.body.isFlagged === true;
    mailService.markFlagged(String(req.params.id), isFlagged);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '操作失败' });
  }
});

// 发送邮件
router.post('/mails/send', async (req: Request, res: Response) => {
  try {
    const input: SendMailInput = req.body;
    if (!input.accountId || !input.to || !input.subject || !input.body) {
      res.status(400).json({ success: false, error: '请填写完整信息' });
      return;
    }

    const account = accountService.getAccountRow(input.accountId);
    if (!account) {
      res.status(404).json({ success: false, error: '账户不存在' });
      return;
    }

    await mailService.sendMail(account, input);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '发送邮件失败' });
  }
});

export default router;
