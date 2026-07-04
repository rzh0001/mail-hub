import { Router, Request, Response } from 'express';
import * as regService from '../services/registration.service';

const router = Router();

/** 安全地从 req.params 读取数字参数 */
function paramId(val: string | string[] | undefined): number | null {
  if (typeof val !== 'string') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

// ====== 网站管理 ======

/** 获取所有网站（含统计） */
router.get('/websites', (_req: Request, res: Response) => {
  try {
    const data = regService.getWebsites();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取网站列表失败' });
  }
});

/** 添加网站域名 */
router.post('/websites', (req: Request, res: Response) => {
  try {
    const { domain } = req.body;
    if (!domain || !domain.trim()) {
      res.status(400).json({ success: false, error: '请提供域名' });
      return;
    }
    const data = regService.addWebsite(domain.trim());
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || '添加网站失败' });
  }
});

/** 删除网站 */
router.delete('/websites/:id', (req: Request, res: Response) => {
  try {
    const id = paramId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, error: '无效的网站 ID' });
      return;
    }
    const deleted = regService.removeWebsite(id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: '网站不存在' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '删除网站失败' });
  }
});

// ====== 注册关系 ======

/** 获取某个网站的注册列表 */
router.get('/websites/:id/registries', (req: Request, res: Response) => {
  try {
    const id = paramId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, error: '无效的网站 ID' });
      return;
    }
    const data = regService.getRegistriesForWebsite(id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取注册列表失败' });
  }
});

/** 手动注册：将指定邮箱注册到某网站 */
router.post('/websites/:id/register', (req: Request, res: Response) => {
  try {
    const websiteId = paramId(req.params.id);
    if (websiteId === null) {
      res.status(400).json({ success: false, error: '无效的网站 ID' });
      return;
    }
    const { accountId } = req.body;
    if (!accountId) {
      res.status(400).json({ success: false, error: '请提供邮箱账户 ID' });
      return;
    }
    regService.registerEmail(accountId, websiteId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '注册失败' });
  }
});

/** 取消注册 */
router.delete('/websites/:websiteId/register/:accountId', (req: Request, res: Response) => {
  try {
    const websiteId = paramId(req.params.websiteId);
    if (websiteId === null) {
      res.status(400).json({ success: false, error: '无效的网站 ID' });
      return;
    }
    const accountId = String(req.params.accountId);
    regService.unregisterEmail(accountId, websiteId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '取消注册失败' });
  }
});

// ====== 随机分配 ======

/** 获取未注册某网站的邮箱列表 */
router.get('/websites/:id/unregistered', (req: Request, res: Response) => {
  try {
    const id = paramId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, error: '无效的网站 ID' });
      return;
    }
    const data = regService.getUnregisteredAccounts(id);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取未注册邮箱失败' });
  }
});

/** 随机分配一个未注册的邮箱 */
router.post('/websites/:id/assign', (req: Request, res: Response) => {
  try {
    const id = paramId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, error: '无效的网站 ID' });
      return;
    }
    const result = regService.randomAssign(id);
    if (!result) {
      res.json({ success: true, data: null, message: '所有邮箱均已注册该网站' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '分配失败' });
  }
});

// ====== 邮件获取 ======

/** 获取某网站发给某邮箱的最新邮件 */
router.get('/websites/:id/mails', (req: Request, res: Response) => {
  try {
    const id = paramId(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, error: '无效的网站 ID' });
      return;
    }
    const accountId = req.query.accountId as string;
    const since = req.query.since as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    if (!accountId) {
      res.status(400).json({ success: false, error: '请提供 accountId 参数' });
      return;
    }

    const data = regService.getWebsiteMails(id, accountId, since, limit);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取邮件失败' });
  }
});

// ====== 初始扫描 ======

/** 手动触发扫描现有邮件 */
router.post('/scan-existing', (_req: Request, res: Response) => {
  try {
    const result = regService.scanExistingMails();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '扫描失败' });
  }
});

export default router;
