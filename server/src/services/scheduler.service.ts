import { getDatabase } from '../database';
import { getAllAccountRows } from './account.service';
import { syncMails } from './mail.service';
import { getSetting } from './settings.service';
import { MAIL_PROVIDERS } from '../types';

const CHECK_INTERVAL_MS = 60_000; // 每分钟检查一次
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
  const db = getDatabase();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as any;
  if (!account) return;

  const folders = getFolders(account.provider || '');
  const maxCount = parseInt(getSetting('sync_max_count') || '50', 10);

  for (const folder of folders) {
    try {
      await syncMails(account, folder, maxCount);
    } catch (err) {
      console.error(`[Scheduler] 同步账户 ${account.email} 文件夹 ${folder} 失败:`, err);
    }
  }

  lastSyncTime[accountId] = Date.now();
}

export function startSyncScheduler(): void {
  if (timer) return;
  console.log('[Scheduler] 自动同步调度器已启动（检查间隔 60 秒）');
  timer = setInterval(() => {
    const intervalMin = parseInt(getSetting('sync_interval') || '2', 10);
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
