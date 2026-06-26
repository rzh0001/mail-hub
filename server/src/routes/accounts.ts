import { Router, Request, Response } from 'express';
import * as accountService from '../services/account.service';
import { syncMails, testImapConnection, sendMail, detectVerificationCode } from '../services/mail.service';
import { getForwardTargets } from '../services/forwarding.service';
import { getDatabase } from '../database';
import { getSetting } from '../services/settings.service';
import { updateLastSyncTime } from '../services/scheduler.service';
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

// 更新账户基本信息
router.put('/accounts/:id', (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const account = accountService.updateAccount(id, req.body);
    if (!account) {
      res.status(404).json({ success: false, error: '账户不存在' });
      return;
    }
    res.json({ success: true, data: account });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '更新账户失败' });
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
    const result = await syncMails(account, req.body.folder || 'INBOX', req.body.maxCount || 50);

    // 自动转发：检查新邮件的转发规则
    if (result.mailIds.length > 0) {
      try {
        const db = getDatabase();
        const placeholders = result.mailIds.map(() => '?').join(',');
        const newMails = db.prepare(`SELECT id, subject, body_text, body_html, from_name, from_address FROM mails WHERE id IN (${placeholders})`).all(...result.mailIds) as any[];
        for (const mail of newMails) {
          // 通用转发规则
          const targets = getForwardTargets(mail.subject, mail.from_address);
          if (targets.length > 0) {
            try {
              await sendMail(account, {
                accountId: account.id,
                to: targets,
                subject: `Fwd: ${mail.subject}`,
                body: `---------- 转发邮件 ----------\n发件人: ${mail.from_name} <${mail.from_address}>\n主题: ${mail.subject}\n\n${mail.body_text}`,
                isHtml: false,
              });
            } catch (forwardErr) {
              console.error(`[Sync] 转发邮件 ${mail.id} 失败:`, forwardErr);
            }
          }
          // 验证码转发
          const vcForwardEnabled = getSetting('verification_forward_enabled');
          const vcTargetsRaw = getSetting('verification_forward_targets');
          if (vcForwardEnabled === 'true' && vcTargetsRaw) {
            try {
              const vcTargets: string[] = JSON.parse(vcTargetsRaw);
              if (vcTargets.length > 0) {
                const code = detectVerificationCode(mail.subject, mail.body_text, mail.from_address);
                if (code) {
                  await sendMail(account, {
                    accountId: account.id,
                    to: vcTargets,
                    subject: `[验证码] ${mail.subject}`,
                    body: `---------- 验证码邮件转发 ----------\n发件人: ${mail.from_name} <${mail.from_address}>\n主题: ${mail.subject}\n验证码: ${code}\n\n${mail.body_text}`,
                    isHtml: false,
                  });
                }
              }
            } catch (vcErr) {
              console.error(`[Sync] 验证码转发邮件 ${mail.id} 失败:`, vcErr);
            }
          }
        }
      } catch (forwardErr) {
        console.error('[Sync] 自动转发处理失败:', forwardErr);
      }
    }

    // 更新调度器计时，避免重复同步
    updateLastSyncTime(id);

    res.json({ success: true, data: { synced: result.synced } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '同步邮件失败' });
  }
});

export default router;
