import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getDatabase } from '../database';

const router = Router();

// 密码哈希：使用 scryptSync，存储格式 "salt:hash"
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return hash === derived;
}

// 初始化默认密码（如果数据库中还没有密码）
function initDefaultPassword(): void {
  const db = getDatabase();
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'app_password_hash'").get() as { value: string } | undefined;
  if (!existing) {
    const h = hashPassword('123456');
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_password_hash', ?)").run(h);
    console.log('[Auth] 已初始化默认密码: 123456');
  }
}

// 自动锁屏默认设置
function initAutoLockDefaults(): void {
  const db = getDatabase();
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_lock_minutes', '5')").run();
}

// 在模块加载时初始化
try {
  initDefaultPassword();
  initAutoLockDefaults();
} catch { /* ignore */ }

// 验证密码
router.post('/auth/verify', (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ success: false, error: '请提供密码' });
      return;
    }
    const db = getDatabase();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'app_password_hash'").get() as { value: string } | undefined;
    if (!row) {
      res.status(500).json({ success: false, error: '密码未初始化' });
      return;
    }
    const ok = verifyPassword(password, row.value);
    if (ok) {
      res.json({ success: true, data: { verified: true } });
    } else {
      res.status(401).json({ success: false, error: '密码错误' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '验证失败' });
  }
});

// 修改密码
router.put('/auth/password', (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ success: false, error: '请提供旧密码和新密码' });
      return;
    }
    if (newPassword.length < 4 || newPassword.length > 64) {
      res.status(400).json({ success: false, error: '密码长度需在 4-64 位之间' });
      return;
    }
    const db = getDatabase();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'app_password_hash'").get() as { value: string } | undefined;
    if (!row) {
      res.status(500).json({ success: false, error: '密码未初始化' });
      return;
    }
    if (!verifyPassword(oldPassword, row.value)) {
      res.status(401).json({ success: false, error: '旧密码错误' });
      return;
    }
    const newHash = hashPassword(newPassword);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_password_hash', ?)").run(newHash);
    res.json({ success: true, data: { changed: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '修改密码失败' });
  }
});

export default router;
