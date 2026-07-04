import { getDatabase } from '../database';

interface WebsiteRow {
  id: number;
  domain: string;
  created_at: string;
}

interface RegistryRow {
  id: number;
  account_id: string;
  website_id: number;
  created_at: string;
}

export interface WebsiteDTO {
  id: number;
  domain: string;
  registeredCount: number;
  totalAccounts: number;
  createdAt: string;
}

export interface RegistryEntryDTO {
  id: number;
  accountId: string;
  accountEmail: string;
  accountName: string;
  websiteId: number;
  createdAt: string;
}

export interface AssignedResult {
  accountId: string;
  email: string;
  accountName: string;
  domain: string;
  registeredCount: number;
  totalAccounts: number;
}

export interface WebsiteMailDTO {
  id: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: string;
  verificationCode: string;
}

/**
 * 已知邮件提供商域名（这些不是注册的网站，跳过）
 */
const SKIP_EMAIL_PROVIDERS = new Set([
  '163.com', '126.com', 'qq.com', 'foxmail.com',
  'gmail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'sina.com', 'sohu.com', 'aliyun.com',
  'icloud.com', 'proton.me', 'pm.me',
]);

/**
 * 常见多段公共后缀（二级域名 + TLD）
 * 对于这些后缀，注册域名需取 3 段
 */
const MULTI_PART_SUFFIXES = new Set([
  // UK
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'net.uk', 'me.uk', 'ltd.uk', 'plc.uk',
  // Australia
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
  // Japan
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp', 'ed.jp', 'gr.jp',
  // Korea
  'co.kr', 'or.kr', 'ne.kr', 'go.kr', 'ac.kr', 'hs.kr', 'ms.kr',
  // China
  'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'ac.cn', 'edu.cn',
  // India
  'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in', 'edu.in',
  // Brazil
  'com.br', 'org.br', 'net.br', 'gov.br', 'edu.br',
  // New Zealand
  'co.nz', 'net.nz', 'org.nz', 'ac.nz', 'govt.nz',
  // Hong Kong
  'com.hk', 'net.hk', 'org.hk', 'gov.hk', 'edu.hk',
  // Taiwan
  'com.tw', 'net.tw', 'org.tw', 'gov.tw', 'edu.tw',
  // Singapore
  'com.sg', 'net.sg', 'org.sg', 'gov.sg', 'edu.sg',
  // Russia
  'com.ru', 'net.ru', 'org.ru', 'gov.ru',
  // European Union
  'eu.com', 'gb.net', 'se.net',
  // Generic
  'com.co', 'net.co', 'nom.co',
  // Others
  'com.vn', 'net.vn', 'org.vn', 'gov.vn',
  'com.ar', 'net.ar', 'org.ar', 'gov.ar',
  'com.mx', 'org.mx', 'net.mx', 'gob.mx',
  'co.za', 'net.za', 'org.za', 'gov.za', 'ac.za',
  'co.il', 'org.il', 'net.il', 'ac.il', 'gov.il',
  'com.tr', 'net.tr', 'org.tr', 'gov.tr',
  'com.pl', 'net.pl', 'org.pl', 'gov.pl',
  'com.ph', 'net.ph', 'org.ph', 'gov.ph',
]);

/**
 * 从裸域名中提取一级域名（注册域名）
 * github.com          → github.com
 * mail.google.com     → google.com
 * auth.example.co.uk  → example.co.uk
 */
function extractRegistrableDomain(domain: string): string {
  const labels = domain.toLowerCase().trim().split('.');
  if (labels.length < 2) return domain;

  // 检查最后两段是否是已知的多段公共后缀
  if (labels.length >= 3) {
    const lastTwo = labels.slice(-2).join('.');
    if (MULTI_PART_SUFFIXES.has(lastTwo)) {
      return labels.slice(-3).join('.');
    }
  }

  // 默认取最后 2 段
  return labels.slice(-2).join('.');
}

/**
 * 从发件人邮箱地址中提取一级域名（注册域名）
 * noreply@github.com          → github.com
 * noreply@mail.google.com     → google.com
 * noreply@auth.example.co.uk  → example.co.uk
 */
function extractDomain(fromAddress: string): string | null {
  if (!fromAddress) return null;
  const parts = fromAddress.split('@');
  if (parts.length < 2) return null;
  const domain = parts[1].toLowerCase().trim();
  if (!domain || domain.includes(' ')) return null;

  return extractRegistrableDomain(domain);
}

// ========== 网站管理 ==========

/** 获取所有网站及统计信息 */
export function getWebsites(): WebsiteDTO[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      w.id,
      w.domain,
      w.created_at,
      COUNT(DISTINCT er.account_id) as registeredCount
    FROM websites w
    LEFT JOIN email_registries er ON er.website_id = w.id
    GROUP BY w.id
    ORDER BY w.domain ASC
  `).all() as any[];

  const totalAccounts = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as any;

  return rows.map(r => ({
    id: r.id,
    domain: r.domain,
    registeredCount: r.registeredCount,
    totalAccounts: totalAccounts.cnt,
    createdAt: r.created_at,
  }));
}

/** 添加网站域名 */
export function addWebsite(domain: string): WebsiteDTO {
  const db = getDatabase();
  // 提取一级域名，去掉子域名前缀
  const cleanDomain = extractRegistrableDomain(domain);

  // 检查是否已存在
  const existing = db.prepare('SELECT * FROM websites WHERE domain = ?').get(cleanDomain) as WebsiteRow | undefined;
  if (existing) {
    throw new Error(`域名 "${cleanDomain}" 已存在`);
  }

  const now = new Date().toISOString();
  db.prepare('INSERT INTO websites (domain, created_at) VALUES (?, ?)').run(cleanDomain, now);

  const row = db.prepare('SELECT * FROM websites WHERE domain = ?').get(cleanDomain) as WebsiteRow;
  const totalAccounts = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as any;
  return {
    id: row.id,
    domain: row.domain,
    registeredCount: 0,
    totalAccounts: totalAccounts.cnt,
    createdAt: row.created_at,
  };
}

/** 删除网站及其注册关系 */
export function removeWebsite(id: number): boolean {
  const db = getDatabase();
  // 外键级联会删除关联的 email_registries
  const result = db.prepare('DELETE FROM websites WHERE id = ?').run(id);
  return result.changes > 0;
}

// ========== 注册关系管理 ==========

/** 获取某个网站的所有注册记录 */
export function getRegistriesForWebsite(websiteId: number): RegistryEntryDTO[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT er.*, a.email as account_email, a.name as account_name
    FROM email_registries er
    LEFT JOIN accounts a ON a.id = er.account_id
    WHERE er.website_id = ?
    ORDER BY er.created_at DESC
  `).all(websiteId) as any[];

  return rows.map(r => ({
    id: r.id,
    accountId: r.account_id,
    accountEmail: r.account_email || '',
    accountName: r.account_name || '',
    websiteId: r.website_id,
    createdAt: r.created_at,
  }));
}

/** 手动注册：将邮箱与网站建立关联 */
export function registerEmail(accountId: string, websiteId: number): boolean {
  const db = getDatabase();
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT OR IGNORE INTO email_registries (account_id, website_id, created_at) VALUES (?, ?, ?)').run(accountId, websiteId, now);
    return true;
  } catch {
    return false;
  }
}

/** 取消注册 */
export function unregisterEmail(accountId: string, websiteId: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM email_registries WHERE account_id = ? AND website_id = ?').run(accountId, websiteId);
  return result.changes > 0;
}

/** 检查邮箱是否已注册过某个网站 */
export function isEmailRegistered(accountId: string, domain: string): boolean {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT 1 FROM email_registries er
    JOIN websites w ON w.id = er.website_id
    WHERE er.account_id = ? AND w.domain = ?
  `).get(accountId, domain);
  return !!row;
}

// ========== 随机分配 ==========

/** 获取未注册某个网站的所有邮箱账户 */
export function getUnregisteredAccounts(websiteId: number): Array<{ id: string; email: string; name: string }> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT a.id, a.email, a.name
    FROM accounts a
    WHERE a.id NOT IN (
      SELECT er.account_id FROM email_registries er WHERE er.website_id = ?
    )
    ORDER BY a.email ASC
  `).all(websiteId) as any[];

  return rows.map(r => ({ id: r.id, email: r.email, name: r.name }));
}

/** 随机分配一个未注册的邮箱 */
export function randomAssign(websiteId: number): AssignedResult | null {
  const db = getDatabase();

  // 获取网站域名
  const website = db.prepare('SELECT * FROM websites WHERE id = ?').get(websiteId) as WebsiteRow | undefined;
  if (!website) throw new Error('网站不存在');

  // 获取未注册该网站的账户
  const unregistered = getUnregisteredAccounts(websiteId);
  if (unregistered.length === 0) {
    return null;
  }

  // 随机选择一个
  const chosen = unregistered[Math.floor(Math.random() * unregistered.length)];

  // 统计
  const totalAccounts = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as any;
  const registeredCount = db.prepare('SELECT COUNT(*) as cnt FROM email_registries WHERE website_id = ?').get(websiteId) as any;

  return {
    accountId: chosen.id,
    email: chosen.email,
    accountName: chosen.name,
    domain: website.domain,
    registeredCount: registeredCount.cnt,
    totalAccounts: totalAccounts.cnt,
  };
}

// ========== 邮件感知（核心：从发件人提取域名，自动建站+注册） ==========

/**
 * 处理一封邮件：提取发件人域名，自动添加网站和注册关系
 * 在同步新邮件时调用
 */
export function processMailFromSender(accountId: string, fromAddress: string): void {
  const domain = extractDomain(fromAddress);
  if (!domain) return;

  // 跳过已知邮件提供商
  if (SKIP_EMAIL_PROVIDERS.has(domain)) return;

  const db = getDatabase();

  // 确保网站存在（不存在则添加）
  let website = db.prepare('SELECT * FROM websites WHERE domain = ?').get(domain) as WebsiteRow | undefined;
  if (!website) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO websites (domain, created_at) VALUES (?, ?)').run(domain, now);
    website = db.prepare('SELECT * FROM websites WHERE domain = ?').get(domain) as WebsiteRow;
  }

  // 建立注册关系（INSERT OR IGNORE 避免重复）
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO email_registries (account_id, website_id, created_at) VALUES (?, ?, ?)')
    .run(accountId, website.id, now);
}

// ========== 初始扫描 ==========

/**
 * 扫描所有现有邮件，提取发件人域名，建立网站列表和注册关系
 * 在服务器启动时调用
 */
export function scanExistingMails(): { websitesAdded: number; registriesAdded: number } {
  const db = getDatabase();
  let websitesAdded = 0;
  let registriesAdded = 0;

  // 获取所有邮件（已删除的不算）
  const mails = db.prepare(`
    SELECT DISTINCT account_id, from_address
    FROM mails
    WHERE is_deleted = 0 AND from_address != ''
  `).all() as Array<{ account_id: string; from_address: string }>;

  // 用 Set 去重 (account_id, domain)
  const seen = new Set<string>();
  const pairs: Array<{ accountId: string; domain: string }> = [];

  for (const mail of mails) {
    const domain = extractDomain(mail.from_address);
    if (!domain) continue;

    // 跳过已知邮件提供商
    if (SKIP_EMAIL_PROVIDERS.has(domain)) continue;

    const key = `${mail.account_id}:${domain}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ accountId: mail.account_id, domain });
  }

  const now = new Date().toISOString();

  const insertWebsite = db.prepare('INSERT OR IGNORE INTO websites (domain, created_at) VALUES (?, ?)');
  const findWebsite = db.prepare('SELECT id FROM websites WHERE domain = ?');
  const insertRegistry = db.prepare('INSERT OR IGNORE INTO email_registries (account_id, website_id, created_at) VALUES (?, ?, ?)');

  const transaction = db.transaction(() => {
    for (const pair of pairs) {
      insertWebsite.run(pair.domain, now);
      const ws = findWebsite.get(pair.domain) as { id: number } | undefined;
      if (ws) {
        const result = insertRegistry.run(pair.accountId, ws.id, now);
        if (result.changes > 0) registriesAdded++;
      }
    }
  });

  transaction();

  // 统计新增的网站数
  const totalWebsites = (db.prepare('SELECT COUNT(*) as cnt FROM websites').get() as any).cnt;

  console.log(`[Registration] 初始扫描完成: ${totalWebsites} 个网站, ${registriesAdded} 条注册关系`);
  return { websitesAdded: totalWebsites, registriesAdded };
}

/**
 * 获取某个网站发给某邮箱的最新邮件列表
 */
export function getWebsiteMails(
  websiteId: number,
  accountId: string,
  since?: string,
  limit: number = 20
): WebsiteMailDTO[] {
  const db = getDatabase();

  // 获取网站域名
  const website = db.prepare('SELECT * FROM websites WHERE id = ?').get(websiteId) as WebsiteRow | undefined;
  if (!website) return [];

  // 查找发件人域名匹配的邮件（支持子域名）
  const likeExact = `%@${website.domain}`;
  const likeSub = `%@%.${website.domain}`;
  let where = 'm.account_id = ? AND (m.from_address LIKE ? OR m.from_address LIKE ?) AND m.is_deleted = 0';
  const params: any[] = [accountId, likeExact, likeSub];

  if (since) {
    where += ' AND m.received_at > ?';
    params.push(since);
  }

  params.push(limit);

  const rows = db.prepare(`
    SELECT m.id, m.subject, m.from_name, m.from_address, m.received_at, m.body_text, m.body_html
    FROM mails m
    WHERE ${where}
    ORDER BY m.received_at DESC
    LIMIT ?
  `).all(...params) as any[];

  // 验证码检测用简单关键词
  return rows.map(r => {
    let code = '';
    const bodyText = r.body_text || '';
    const bodyHtml = r.body_html || '';
    const subject = r.subject || '';
    // 简单验证码提取
    const codeMatch = bodyText.match(/验证码[：:\s]*([A-Z0-9]{4,8})/i)
      || bodyText.match(/(?:code|otp|pin)[：:\s]*([A-Z0-9]{4,8})/i)
      || subject.match(/验证码[：:\s]*([A-Z0-9]{4,8})/i);
    if (codeMatch) code = codeMatch[1];

    return {
      id: r.id,
      subject: subject,
      fromName: r.from_name || '',
      fromAddress: r.from_address || '',
      receivedAt: r.received_at,
      verificationCode: code,
      bodyText: bodyText,
      bodyHtml: bodyHtml,
    };
  });
}

/**
 * 迁移历史脏数据：将已有网站域名归一化为一级域名
 * 例如 accountprotection.microsoft.com → microsoft.com
 * 并在存在重复时合并注册关系
 */
export function normalizeExistingWebsites(): { normalized: number; merged: number } {
  const db = getDatabase();
  let normalized = 0;
  let merged = 0;

  const allWebsites = db.prepare('SELECT * FROM websites ORDER BY id').all() as WebsiteRow[];

  for (const ws of allWebsites) {
    const normalizedDomain = extractRegistrableDomain(ws.domain);
    if (normalizedDomain === ws.domain) continue;

    // 需要归一化
    const target = db.prepare('SELECT id FROM websites WHERE domain = ?').get(normalizedDomain) as { id: number } | undefined;

    if (target) {
      // 目标域名已存在 → 把当前网站的注册关系迁移过去，然后删除当前网站
      db.prepare(`
        INSERT OR IGNORE INTO email_registries (account_id, website_id, created_at)
        SELECT er.account_id, ?, er.created_at
        FROM email_registries er WHERE er.website_id = ?
      `).run(target.id, ws.id);
      db.prepare('DELETE FROM email_registries WHERE website_id = ?').run(ws.id);
      db.prepare('DELETE FROM websites WHERE id = ?').run(ws.id);
      merged++;
      console.log(`  [迁移] 合并: ${ws.domain} → ${normalizedDomain}`);
    } else {
      // 目标域名不存在 → 直接更新
      db.prepare('UPDATE websites SET domain = ? WHERE id = ?').run(normalizedDomain, ws.id);
      normalized++;
      console.log(`  [迁移] 归一化: ${ws.domain} → ${normalizedDomain}`);
    }
  }

  if (normalized > 0 || merged > 0) {
    console.log(`[Registration] 域名迁移完成: ${normalized} 个归一化, ${merged} 个合并`);
  }
  return { normalized, merged };
}
