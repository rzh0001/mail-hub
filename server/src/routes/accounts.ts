import { Router, Request, Response } from 'express';
import * as accountService from '../services/account.service';
import { syncMails, testImapConnection } from '../services/mail.service';
import type { CreateAccountInput } from '../types';

const router = Router();

// 获取邮箱提供商列表
router.get('/providers', (_req: Request, res: Response) => {
  res.json({ success: true, data: accountService.getProviders() });
});

// 获取所有账户
router.get('/accounts', (_req: Request, res: Response) => {
  const accounts = accountService.getAllAccounts();
  res.json({ success: true, data: accounts });
});

// 添加账户
router.post('/accounts', async (req: Request, res: Response) => {
  try {
    const input: CreateAccountInput = req.body;
    if (!input.email || !input.authCode || !input.name) {
      res.status(400).json({ success: false, error: '请填写完整信息：名称、邮箱地址、授权码' });
      return;
    }
    const account = accountService.createAccount(input);
    res.json({ success: true, data: account });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '添加账户失败' });
  }
});

// 获取账户配置（含授权码）
router.get('/accounts/:id/config', (req: Request, res: Response) => {
  const config = accountService.getAccountConfig(String(req.params.id));
  if (!config) {
    res.status(404).json({ success: false, error: '账户不存在' });
    return;
  }
  res.json({ success: true, data: config });
});

// 导出所有账户配置
router.get('/accounts/export', (_req: Request, res: Response) => {
  const data = accountService.exportAllAccounts();
  res.json({ success: true, data });
});

// 批量导入账户
router.post('/accounts/import', (req: Request, res: Response) => {
  try {
    const accounts = req.body.accounts;
    if (!Array.isArray(accounts) || accounts.length === 0) {
      res.status(400).json({ success: false, error: '请提供有效的账户列表' });
      return;
    }
    const result = accountService.importAccounts(accounts);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '导入失败' });
  }
});

// 删除账户
router.delete('/accounts/:id', (req: Request, res: Response) => {
  const deleted = accountService.deleteAccount(String(req.params.id));
  if (deleted) {
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '账户不存在' });
  }
});

// 测试连接
router.post('/accounts/:id/test', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const account = accountService.getAccountRow(id);
    if (!account) {
      res.status(404).json({ success: false, error: '账户不存在' });
      return;
    }
    const ok = await testImapConnection(
      account.imap_host, account.imap_port, account.imap_secure === 1,
      account.email, account.auth_code
    );
    res.json({ success: true, data: { connected: ok } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '连接测试失败' });
  }
});

// 同步邮件
router.post('/accounts/:id/sync', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const account = accountService.getAccountRow(id);
    if (!account) {
      res.status(404).json({ success: false, error: '账户不存在' });
      return;
    }
    const count = await syncMails(account, req.body.folder || 'INBOX', req.body.maxCount || 50);
    res.json({ success: true, data: { synced: count } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '同步邮件失败' });
  }
});

export default router;
