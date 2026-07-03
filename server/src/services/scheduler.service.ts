import { getDatabase } from '../database';
import { getAllAccountRows } from './account.service';
import { syncMails } from './mail.service';
import { executeForwarding } from './forwarding.service';
import { getSetting } from './settings.service';
import { MAIL_PROVIDERS } from '../types';

const CHECK_INTERVAL_MS = 15_000; // 每15秒检查一次（支持30秒同步间隔）
let timer: NodeJS.Timeout | null = null;
const lastSyncTime: Record<string, number> = {}; // account_id -> 上次同步时间戳

function getFolders(provider: string): string[] {
  const folders: string[] = ['INBOX'];
  const p = MAIL_PROVIDERS[provider];
  if (p) {
    folders.push(p.sentFolder, p.trashFolder);
  }
  return folders;
}

async function syncAccountFolders(accountId: string): Promise<void> {
  // 互斥锁：防止同一账户的并发同步
  if (syncLocks[accountId]) return;
  syncLocks[accountId] = true;
  try {
  const db = getDatabase();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
  if (!account) return;

  const folders = getFolders(account.provider || '');
  const maxCount = parseInt(getSetting('sync_max_count') || '50', 10);

  for (const folder of folders) {
    try {
      const result = await syncMails(account, folder, maxCount);

      // 自动转发：处理新邮件的转发规则和验证码转发
      if (result.mailIds.length > 0) {
        try {
          const placeholders = result.mailIds.map(() => '?').join(',');
          const newMails = db.prepare(`SELECT id, subject, body_text, body_html, from_name, from_address, account_id, folder, message_uid FROM mails WHERE id IN (${placeholders})`).all(...result.mailIds) as any[];
          for (const mail of newMails) {
            // 原子 claim：这封邮件的转发归我处理，处理完不再处理
            const claim = db.prepare('UPDATE mails SET forwarded = 1 WHERE id = ? AND forwarded = 0').run(mail.id);
            if (claim.changes === 0) continue;

            await executeForwarding(mail, account);
          }
        } catch (forwardErr) {
          console.error('[Scheduler] 自动转发处理失败:', forwardErr);
        }
      }
    } catch (err) {
      console.error(`[Scheduler] 同步账户 ${account.email} 文件夹 ${folder} 失败:`, err);
    }
  }

  lastSyncTime[accountId] = Date.now();
  } finally { syncLocks[accountId] = false; }
}

// 每个账户的同步互斥锁，防止并发重叠
const syncLocks: Record<string, boolean> = {};

export function startSyncScheduler(): void {
  if (timer) return;
  console.log('[Scheduler] 自动同步调度器已启动（检查间隔 15 秒）');

  // 启动时将各账户的上次同步时间初始化为当前时间，避免启动后立即洪水同步
  const now = Date.now();
  try {
    const accounts = getAllAccountRows();
    for (const a of accounts) {
      lastSyncTime[a.id] = now;
    }
  } catch { /* 忽略 */ }

  timer = setInterval(() => {
    const intervalMin = parseFloat(getSetting('sync_interval') || '2');
    if (intervalMin <= 0) return; // 手动模式

    const intervalMs = intervalMin * 60 * 1000;
    const now = Date.now();

    try {
      const accounts = getAllAccountRows();
      for (const account of accounts) {
        const lastSync = lastSyncTime[account.id] || 0;
        if (now - lastSync >= intervalMs) {
          syncAccountFolders(account.id).catch(err => {
            console.error(`[Scheduler] 同步账户 ${account.email} 失败:`, err);
          });
        }
      }
    } catch (err) {
      console.error('[Scheduler] 检查账户时出错:', err);
    }
  }, CHECK_INTERVAL_MS);
}

export function stopSyncScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[Scheduler] 自动同步调度器已停止');
  }
}

/** 手动同步后调用，重置调度器计时 */
export function updateLastSyncTime(accountId: string): void {
  lastSyncTime[accountId] = Date.now();
}
