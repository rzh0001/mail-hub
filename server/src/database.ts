import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', 'data', 'mailhub.db');

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    // 确保数据目录存在
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables(): void {
  const database = db;

  database.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      imap_host TEXT NOT NULL,
      imap_port INTEGER NOT NULL,
      imap_secure INTEGER NOT NULL DEFAULT 1,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      smtp_secure INTEGER NOT NULL DEFAULT 1,
      auth_code TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      avatar_color TEXT NOT NULL DEFAULT '',
      avatar_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mails (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      message_uid INTEGER NOT NULL,
      folder TEXT NOT NULL DEFAULT 'INBOX',
      from_name TEXT NOT NULL DEFAULT '',
      from_address TEXT NOT NULL DEFAULT '',
      to_list TEXT NOT NULL DEFAULT '[]',
      cc_list TEXT NOT NULL DEFAULT '[]',
      subject TEXT NOT NULL DEFAULT '',
      body_text TEXT NOT NULL DEFAULT '',
      body_html TEXT NOT NULL DEFAULT '',
      attachments TEXT NOT NULL DEFAULT '[]',
      received_at TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_mails_account ON mails(account_id);
    CREATE INDEX IF NOT EXISTS idx_mails_folder ON mails(account_id, folder);
    CREATE INDEX IF NOT EXISTS idx_mails_uid ON mails(account_id, message_uid);
    CREATE INDEX IF NOT EXISTS idx_mails_received ON mails(received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mails_subject ON mails(subject);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('subject_keyword', 'sender_pattern')),
      value TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forwarding_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('subject_keyword', 'sender_pattern')),
      value TEXT NOT NULL,
      target_email TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trash_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('subject_keyword', 'sender_pattern')),
      value TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forwarding_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('email', 'serverchan', 'wecom_bot', 'feishu_bot')),
      name TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // 迁移：为已有数据库添加新字段
  try { database.exec("ALTER TABLE accounts ADD COLUMN avatar_color TEXT NOT NULL DEFAULT ''"); } catch {}
  try { database.exec("ALTER TABLE accounts ADD COLUMN avatar_name TEXT NOT NULL DEFAULT ''"); } catch {}
  try { database.exec("ALTER TABLE forwarding_rules ADD COLUMN method_id INTEGER DEFAULT NULL REFERENCES forwarding_methods(id)"); } catch {}

  // 初始化默认设置
  const insertSetting = database.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('sync_interval', '2');
  insertSetting.run('sync_max_count', '50');
  insertSetting.run('auto_mark_verification', 'true');
  insertSetting.run('verification_forward_enabled', 'false');
  insertSetting.run('verification_code_max_length', '8');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
