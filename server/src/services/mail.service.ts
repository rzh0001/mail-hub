import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser, type AddressObject } from 'mailparser';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../database';
import { MAIL_PROVIDERS } from '../types';
import type { AccountRow, MailRow, MailSummary, MailDetail, Attachment, ForwardLog, SendMailInput } from '../types';
import { matchesTrashRule } from './trash.service';
import { getSetting } from './settings.service';

// ---------- 验证码检测（内置规则 + 数据库自定义规则）----------
// 内置规则源码（用于显示 & 编译为正则）
const BUILTIN_KEYWORDS_SRC = [
  '验证码', '认证码', '安全验证', '登录验证', '注册验证',
  '动态密码', '一次性密码', '安全码', '校验码',
  'verification\\s*code', 'otp', 'one\\.?time', 'auth\\s*code',
  '2fa', 'two\\.?factor', 'confirm.*code', 'security\\s*code',
  'temporary\\s*password', 'magic\\s*link', 'login\\s*link', 'passcode',
  'apple.*(?:id|code|验证|verify)', 'amazon.*(?:code|otp|验证)',
];
const BUILTIN_KEYWORDS = BUILTIN_KEYWORDS_SRC.map(s => new RegExp(s, 'i'));

const BUILTIN_EXTRACT = [
  // 字母+数字混合验证码（放在纯数字前优先匹配，结尾断言防止截取长串）
  /验证码[：:\s]*([A-Z0-9]{4,8})(?![A-Z0-9])/i,
  /(?:code|otp|pin|passcode)[：:\s]*([A-Z0-9]{4,8})(?![A-Z0-9])/i,
  // 以下纯数字规则也加字母数字边界，避免从长串中截取前几位
  /验证码[：:]\s*(\d{4,8})(?![A-Z0-9])/,
  /验证码.*?[是:：]?\s*(\d{4,8})(?![A-Z0-9])/,
  /(?:apple|apply)\s*id\s*(?:code|验证码)[：:\s]*(\d{4,8})(?![A-Z0-9])/i,
  /(?:code|otp|pin|passcode)[：:\s]*(\d{4,8})(?![A-Z0-9])/i,
  /(\d{4,8})\s*(?:is|为|是)\s*(?:your\s+)?(?:verification|code|otp|apple)(?![A-Z0-9])/i,
  /(?:code|otp)\s+is\s+(\d{4,8})(?![A-Z0-9])/i,
  // 纯数字保底（前后都不能是字母或数字；仅靠自身无法判定上下文，需配合成行检查过滤行内数字）
  /(?<![A-Z0-9])(\d{4,8})(?![A-Z0-9])/i,
];

/** 保底提取规则在数组中的索引，仅对其做独立成行检查 */
const CATCHALL_EXTRACT_INDEX = BUILTIN_EXTRACT.length - 1;

// 导出的内置规则列表（用于设置页面展示）
export function getBuiltinRules(): Array<{ id: string; type: 'subject_keyword' | 'extract_pattern'; value: string }> {
  const kws = BUILTIN_KEYWORDS_SRC.map((v, i) => ({ id: `kw_${i}`, type: 'subject_keyword' as const, value: v }));
  const extracts = BUILTIN_EXTRACT.map((v, i) => ({ id: `extract_${i}`, type: 'extract_pattern' as const, value: v.source }));
  return [...kws, ...extracts];
}

interface VCRuleSet {
  keywords: RegExp[];
  disabledBuiltin: Set<string>;
}

function loadDisabledBuiltin(): Set<string> {
  try {
    const db = getDatabase();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'disabled_builtin_rules'").get() as { value: string } | undefined;
    if (row && row.value) {
      const arr: string[] = JSON.parse(row.value);
      return new Set(arr);
    }
  } catch { /* ignore */ }
  return new Set();
}

function loadCustomRules(): VCRuleSet {
  const disabledBuiltin = loadDisabledBuiltin();
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT type, value FROM verification_rules WHERE enabled = 1').all() as { type: string; value: string }[];
    const keywords: RegExp[] = [];
    for (const r of rows) {
      try {
        const re = new RegExp(r.value, 'i');
        if (r.type === 'subject_keyword') keywords.push(re);
      } catch { /* 忽略无效正则 */ }
    }
    return { keywords, disabledBuiltin };
  } catch {
    return { keywords: [], disabledBuiltin };
  }
}

export function detectVerificationCode(subject: string, bodyText: string, fromAddress: string, customRules?: VCRuleSet): string {
  const cr = customRules || { keywords: [], disabledBuiltin: new Set() };

  // 过滤掉已关闭的内置规则
  const enabledKeywords = BUILTIN_KEYWORDS.filter((_, i) => !cr.disabledBuiltin.has(`kw_${i}`));
  const allKeywords = [...enabledKeywords, ...cr.keywords];

  // 如果正文简短且内容本身就是纯验证码格式（无关键词上下文时的兜底）
  // 纯数字 >= 6 位才认为是验证码，避免将 5 位邮编等数字误识别
  const trimmedBody = bodyText.trim();
  const bodyLooksLikeCode = trimmedBody.length <= 20 && (
    /^[A-Za-z0-9]{4,8}$/.test(trimmedBody) && /[A-Za-z]/.test(trimmedBody) ||
    /^\d{6,8}$/.test(trimmedBody)
  );

  const keywordMatch = allKeywords.some(p => p.test(subject)) || allKeywords.some(p => p.test(bodyText));
  if (!keywordMatch) {
    // 无关键词匹配时，如果正文本身就是验证码格式则直接返回
    if (bodyLooksLikeCode) return trimmedBody;
    return '';
  }

  // 过滤已关闭的提取规则
  const enabledExtract = BUILTIN_EXTRACT.filter((_, i) => !cr.disabledBuiltin.has(`extract_${i}`));

  const maxLen = parseInt(getSetting('verification_code_max_length') || '8', 10);
  const textToSearch = `${bodyText}\n${subject}`;
  for (const p of enabledExtract) {
    // 用全局模式循环匹配，一处匹配被拒绝后继续找下一处
    const re = new RegExp(p.source, p.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(textToSearch)) !== null) {
      if (m[1].length > maxLen) continue;
      // 仅对保底的纯数字规则做独立成行检查（前后必须是换行/开头/结尾）
      if (p === BUILTIN_EXTRACT[CATCHALL_EXTRACT_INDEX]) {
        const before = textToSearch[m.index - 1];
        if (before !== undefined && before !== '\n' && before !== '\r') continue;
        const after = textToSearch[m.index + m[0].length];
        if (after !== undefined && after !== '\n' && after !== '\r') continue;
      }
      return m[1];
    }
  }
  return '';
}
// ---------- 验证码检测结束 ----------

// 安全地从中提取地址列表，兼容 AddressObject | AddressObject[]
function extractAddresses(addr: AddressObject | AddressObject[] | undefined): Array<{ name?: string; address?: string }> {
  if (!addr) return [];
  if (Array.isArray(addr)) {
    return addr.flatMap(a => (a as AddressObject).value || []);
  }
  return addr.value || [];
}

// 从IMAP同步邮件到本地数据库
export async function syncMails(account: AccountRow, folder: string = 'INBOX', maxCount: number = 50): Promise<{ synced: number; mailIds: string[] }> {
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: {
      user: account.email,
      pass: account.auth_code,
    },
    logger: false,
  });

  let synced = 0;
  const mailIds: string[] = [];

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(folder);
    const total = mailbox.exists;

    if (total === 0) return { synced: 0, mailIds: [] };

    const db = getDatabase();

    // 查询已存在的 UID 集合（按文件夹查询，避免不同文件夹同 UID 号误判）
    const existingUids = new Set(
      db.prepare('SELECT message_uid FROM mails WHERE account_id = ? AND folder = ?')
        .all(account.id, folder)
        .map((r: any) => r.message_uid)
    );

    // 从最新的邮件开始同步
    const startSeq = Math.max(1, total - maxCount + 1);

    for await (const msg of client.fetch(`${startSeq}:${total}`, {
      uid: true,
      envelope: true,
      bodyStructure: true,
      source: true,
      flags: true,
      internalDate: true,
    })) {
      if (existingUids.has(msg.uid)) continue;

      // 解析邮件内容
      const parsed = await simpleParser(msg.source!);
      const fromAddr = extractAddresses(parsed.from)[0];
      const toList = extractAddresses(parsed.to).map(v => v.address).filter(Boolean);
      const ccList = extractAddresses(parsed.cc).map(v => v.address).filter(Boolean);

      // 处理日期
      const rawDate = msg.internalDate || new Date();
      const receivedAt = parsed.date ? new Date(parsed.date).toISOString() : new Date(rawDate).toISOString();

      // 附件信息（只存元数据，不存文件内容）
      const attachments: Attachment[] = (parsed.attachments || [])
        .filter(att => att.filename)
        .map(att => ({
          filename: att.filename || 'unnamed',
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || 0,
        }));

      // 检查垃圾箱规则 + 垃圾箱文件夹标记
      const subject = parsed.subject || '';
      const fromAddress = fromAddr?.address || '';
      const isTrashFolder = folder === getTrashFolderForProvider(account.provider);
      const isDeletedByRule = (isTrashFolder || matchesTrashRule(subject, fromAddress)) ? 1 : 0;

      const mail: MailRow = {
        id: uuid(),
        account_id: account.id,
        message_uid: msg.uid,
        folder,
        from_name: fromAddr?.name || '',
        from_address: fromAddress,
        to_list: JSON.stringify(toList),
        cc_list: JSON.stringify(ccList),
        subject,
        body_text: parsed.text || '',
        body_html: parsed.html || '',
        attachments: JSON.stringify(attachments),
        received_at: receivedAt,
        is_read: msg.flags?.has('\\Seen') ? 1 : 0,
        is_flagged: msg.flags?.has('\\Flagged') ? 1 : 0,
        is_deleted: isDeletedByRule,
        forwarded: 0,
        created_at: new Date().toISOString(),
      };

      // INSERT OR IGNORE + 检查插入是否成功，防止并发重复行进入 mailIds
      const result = db.prepare(`
        INSERT OR IGNORE INTO mails (id, account_id, message_uid, folder, from_name, from_address, to_list, cc_list,
          subject, body_text, body_html, attachments, received_at, is_read, is_flagged, is_deleted, forwarded, created_at)
        VALUES (@id, @account_id, @message_uid, @folder, @from_name, @from_address, @to_list, @cc_list,
          @subject, @body_text, @body_html, @attachments, @received_at, @is_read, @is_flagged, @is_deleted, @forwarded, @created_at)
      `).run(mail);
      if (result.changes === 0) continue; // 并发冲突，另一个线程已经插入了这封邮件
      mailIds.push(mail.id);

      // 垃圾箱规则匹配 → 同步删除到 IMAP 服务器
      if (isDeletedByRule) {
        try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Deleted']); } catch { /* ignore */ }
      }

      synced++;
    }

    await client.logout();
    return { synced, mailIds };
  } catch (err) {
    // 确保断开连接
    try { await client.logout(); } catch { /* ignore */ }
    throw err;
  }
}

// 发送邮件
export async function sendMail(account: AccountRow, input: SendMailInput): Promise<boolean> {
  const transporter = nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    secure: account.smtp_secure === 1,
    auth: {
      user: account.email,
      pass: account.auth_code,
    },
  });

  await transporter.sendMail({
    from: `"${account.name}" <${account.email}>`,
    to: input.to.join(', '),
    cc: input.cc?.join(', '),
    bcc: input.bcc?.join(', '),
    subject: input.subject,
    text: input.isHtml ? undefined : input.body,
    html: input.isHtml ? input.body : undefined,
  });

  return true;
}

// 通过IMAP将已读状态同步到服务器
async function syncReadToServer(accountId: string, messageUids: number[]): Promise<void> {
  const db = getDatabase();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow | undefined;
  if (!account || messageUids.length === 0) return;

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.email, pass: account.auth_code },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    for (const uid of messageUids) {
      try { await client.messageFlagsAdd({ uid }, ['\\Seen']); } catch { /* 单个失败跳过 */ }
    }
    await client.logout();
  } catch {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

// 标记邮件已读/未读（本地 + 异步同步到服务器）
export function markRead(mailId: string, isRead: boolean): void {
  const db = getDatabase();
  const mail = db.prepare('SELECT * FROM mails WHERE id = ?').get(mailId) as any;
  if (!mail) return;
  db.prepare('UPDATE mails SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, mailId);
  if (isRead) {
    syncReadToServer(mail.account_id, [mail.message_uid]);
  } else {
    syncServerFlags(mail.account_id, mail.folder, [mail.message_uid], '\\Seen', false);
  }
}

// 批量标记已读
export function batchMarkRead(mailIds: string[]): void {
  if (mailIds.length === 0) return;
  const db = getDatabase();
  const placeholders = mailIds.map(() => '?').join(',');
  db.prepare(`UPDATE mails SET is_read = 1 WHERE id IN (${placeholders})`).run(...mailIds);

  // 按账户分组同步到IMAP
  const mails = db.prepare(`SELECT account_id, message_uid FROM mails WHERE id IN (${placeholders})`).all(...mailIds) as any[];
  const grouped: Record<string, number[]> = {};
  for (const m of mails) {
    if (!grouped[m.account_id]) grouped[m.account_id] = [];
    grouped[m.account_id].push(m.message_uid);
  }
  for (const [accountId, uids] of Object.entries(grouped)) {
    syncReadToServer(accountId, uids);
  }
}

// 全部标记已读（按账户）
export function markAllRead(accountId?: string): number {
  const db = getDatabase();

  let where = 'WHERE is_deleted = 0 AND is_read = 0';
  const params: any[] = [];

  if (accountId) {
    where += ' AND account_id = ?';
    params.push(accountId);
  }

  // 获取受影响的邮件用于 IMAP 同步
  const mails = db.prepare(`SELECT account_id, message_uid FROM mails ${where}`).all(...params) as any[];
  const grouped: Record<string, number[]> = {};
  for (const m of mails) {
    if (!grouped[m.account_id]) grouped[m.account_id] = [];
    grouped[m.account_id].push(m.message_uid);
  }

  // 更新
  const result = db.prepare(`UPDATE mails SET is_read = 1 ${where}`).run(...params);

  // 同步到 IMAP
  for (const [accId, uids] of Object.entries(grouped)) {
    syncReadToServer(accId, uids);
  }

  return result.changes;
}

// 通过IMAP将删除同步到服务器
async function syncDeleteToServer(accountId: string, folder: string, messageUids: number[]): Promise<void> {
  if (messageUids.length === 0) return;
  const db = getDatabase();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow | undefined;
  if (!account) return;

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.email, pass: account.auth_code },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen(folder);
    for (const uid of messageUids) {
      try { await client.messageFlagsAdd({ uid }, ['\\Deleted']); } catch { /* 单个失败跳过 */ }
    }
    await client.logout();
  } catch {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

// 通过IMAP添加或移除标记
async function syncServerFlags(accountId: string, folder: string, messageUids: number[], flag: string, add: boolean): Promise<void> {
  if (messageUids.length === 0) return;
  const db = getDatabase();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow | undefined;
  if (!account) return;

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.email, pass: account.auth_code },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen(folder);
    for (const uid of messageUids) {
      try {
        if (add) {
          await client.messageFlagsAdd({ uid }, [flag]);
        } else {
          await client.messageFlagsRemove({ uid }, [flag]);
        }
      } catch { /* 单个失败跳过 */ }
    }
    await client.logout();
  } catch {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

// 标记星标（本地 + IMAP）
export function markFlagged(mailId: string, isFlagged: boolean): void {
  const db = getDatabase();
  const mail = db.prepare('SELECT * FROM mails WHERE id = ?').get(mailId) as any;
  if (!mail) return;
  db.prepare('UPDATE mails SET is_flagged = ? WHERE id = ?').run(isFlagged ? 1 : 0, mailId);
  syncServerFlags(mail.account_id, mail.folder, [mail.message_uid], '\\Flagged', isFlagged);
}

// 获取账户的垃圾箱文件夹名
function getTrashFolder(accountId: string): string {
  const db = getDatabase();
  const account = db.prepare('SELECT provider FROM accounts WHERE id = ?').get(accountId) as { provider: string } | undefined;
  return getTrashFolderForProvider(account?.provider || '');
}

// 根据提供商获取垃圾箱文件夹名
function getTrashFolderForProvider(provider: string): string {
  if (provider && MAIL_PROVIDERS[provider]) {
    return MAIL_PROVIDERS[provider].trashFolder;
  }
  return '已删除';
}

// 通过IMAP将邮件移到垃圾箱（MOVE 命令）
async function syncMoveToTrash(accountId: string, folder: string, messageUids: number[]): Promise<void> {
  if (messageUids.length === 0) return;
  const db = getDatabase();
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow | undefined;
  if (!account) return;

  const trashFolder = getTrashFolder(accountId);

  // 如果邮件已在垃圾箱文件夹，跳过
  if (folder === trashFolder) return;

  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.email, pass: account.auth_code },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen(folder);
    // 尝试 MOVE 到垃圾箱（如果服务器支持）
    try {
      const uidSeq = messageUids.sort((a, b) => a - b).join(',');
      await client.messageMove({ uid: uidSeq }, trashFolder);
    } catch {
      // 降级：标记为已删除
      for (const uid of messageUids) {
        try { await client.messageFlagsAdd({ uid }, ['\\Deleted']); } catch { /* ignore */ }
      }
    }
    await client.logout();
  } catch {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

// 标记删除（本地 + IMAP）
export function markDeleted(mailId: string): void {
  const db = getDatabase();
  const mail = db.prepare('SELECT * FROM mails WHERE id = ?').get(mailId) as any;
  if (!mail) return;
  db.prepare('UPDATE mails SET is_deleted = 1 WHERE id = ?').run(mailId);
  // 异步 IMAP 操作：尝试 MOVE 到垃圾箱（保持服务端一致，不阻塞响应）
  syncMoveToTrash(mail.account_id, mail.folder, [mail.message_uid]).catch(err => {
    console.error(`[Delete] IMAP MOVE 失败 (${mailId}):`, err);
  });
}

// 批量标记删除（本地 + IMAP）
export function batchMarkDeleted(mailIds: string[]): void {
  if (mailIds.length === 0) return;
  const db = getDatabase();
  const placeholders = mailIds.map(() => '?').join(',');
  const mails = db.prepare(`SELECT * FROM mails WHERE id IN (${placeholders})`).all(...mailIds) as any[];

  for (const mail of mails) {
    db.prepare('UPDATE mails SET is_deleted = 1 WHERE id = ?').run(mail.id);
    syncMoveToTrash(mail.account_id, mail.folder, [mail.message_uid]).catch(err => {
      console.error(`[BatchDelete] IMAP MOVE 失败 (${mail.id}):`, err);
    });
  }
}

// 获取邮件列表
export function getMailList(accountId?: string, folder?: string, page: number = 1, pageSize: number = 20, query?: string): { mails: MailSummary[], total: number } {
  const db = getDatabase();

  // 草稿箱特殊处理：从 drafts 表读取
  if (folder === '草稿箱') {
    let draftWhere = 'WHERE 1=1';
    const draftParams: any[] = [];
    if (accountId) {
      draftWhere += ' AND d.account_id = ?';
      draftParams.push(accountId);
    }
    if (query && query.trim()) {
      const like = `%${query.trim()}%`;
      draftWhere += ' AND (d.subject LIKE ?)';
      draftParams.push(like);
    }
    const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM drafts d ${draftWhere}`).get(...draftParams) as any;
    const total = countRow.cnt;
    const offset = (page - 1) * pageSize;
    draftParams.push(pageSize, offset);

    const draftRows = db.prepare(`
      SELECT d.*, a.name as account_name, a.email as account_email, a.avatar_color, a.avatar_name
      FROM drafts d
      LEFT JOIN accounts a ON d.account_id = a.id
      ${draftWhere}
      ORDER BY d.updated_at DESC
      LIMIT ? OFFSET ?
    `).all(...draftParams) as any[];

    const mails: MailSummary[] = draftRows.map(r => ({
      id: r.id,
      accountId: r.account_id,
      accountName: r.account_name || '',
      accountEmail: r.account_email || '',
      avatarColor: r.avatar_color || '',
      avatarName: r.avatar_name || '',
      folder: '草稿箱',
      fromName: '',
      fromAddress: r.account_email || '',
      subject: r.subject || '(无主题)',
      receivedAt: r.updated_at,
      isRead: true,
      isFlagged: false,
      hasAttachments: false,
      verificationCode: '',
    }));
    return { mails, total };
  }

  // 已删除/垃圾箱：按 is_deleted 查询
  let where = (folder === '已删除' || folder === '垃圾箱') ? 'WHERE m.is_deleted = 1' : 'WHERE m.is_deleted = 0';
  const params: any[] = [];

  if (accountId) {
    where += ' AND m.account_id = ?';
    params.push(accountId);
  }
  if (folder) {
    where += ' AND m.folder = ?';
    params.push(folder);
  }
  if (query && query.trim()) {
    const like = `%${query.trim()}%`;
    where += ' AND (m.subject LIKE ? OR m.from_address LIKE ? OR m.from_name LIKE ?)';
    params.push(like, like, like);
  }

  // 取总数
  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM mails m ${where}`).get(...params) as any;
  const total = countRow.cnt;

  // 分页
  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const rows = db.prepare(`
    SELECT m.*, a.name as account_name, a.email as account_email, a.avatar_color, a.avatar_name
    FROM mails m
    LEFT JOIN accounts a ON m.account_id = a.id
    ${where}
    ORDER BY m.received_at DESC
    LIMIT ? OFFSET ?
  `).all(...params) as any[];

  const customRules = loadCustomRules();
  const mails: MailSummary[] = rows.map(r => ({
    id: r.id,
    accountId: r.account_id,
    accountName: r.account_name || '',
    accountEmail: r.account_email || '',
    avatarColor: r.avatar_color || '',
    avatarName: r.avatar_name || '',
    folder: r.folder,
    fromName: r.from_name,
    fromAddress: r.from_address,
    subject: r.subject,
    receivedAt: r.received_at,
    isRead: r.is_read === 1,
    isFlagged: r.is_flagged === 1,
    hasAttachments: JSON.parse(r.attachments || '[]').length > 0,
    verificationCode: detectVerificationCode(r.subject || '', r.body_text || '', r.from_address || '', customRules),
  }));

  return { mails, total };
}

// 获取邮件详情
// 按 UID 从 IMAP 拉取单封邮件的正文并更新数据库
export async function fetchMailBody(account: AccountRow, folder: string, uid: number, mailId: string): Promise<{ bodyText: string; bodyHtml: string } | null> {
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure === 1,
    auth: { user: account.email, pass: account.auth_code },
    logger: false,
  });
  try {
    await client.connect();
    await client.mailboxOpen(folder);
    for await (const msg of client.fetch({ uid }, { source: true })) {
      const parsed = await simpleParser(msg.source!);
      const bodyText = parsed.text || '';
      const bodyHtml = parsed.html || '';
      const db = getDatabase();
      db.prepare('UPDATE mails SET body_text = ?, body_html = ? WHERE id = ?').run(bodyText, bodyHtml, mailId);
      return { bodyText, bodyHtml };
    }
    await client.logout();
  } catch {
    try { await client.logout(); } catch { /* ignore */ }
  }
  return null;
}

export async function getMailDetail(mailId: string): Promise<MailDetail | null> {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT m.*, a.name as account_name, a.email as account_email, a.avatar_color, a.avatar_name
    FROM mails m
    LEFT JOIN accounts a ON m.account_id = a.id
    WHERE m.id = ?
  `).get(mailId) as any;

  if (!row) return null;

  // 自动标记为已读
  if (!row.is_read) {
    db.prepare('UPDATE mails SET is_read = 1 WHERE id = ?').run(mailId);
  }

  // 正文为空时从 IMAP 按需拉取
  let bodyText = row.body_text || '';
  let bodyHtml = row.body_html || '';
  if (!bodyText && !bodyHtml) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(row.account_id) as AccountRow | undefined;
    if (account) {
      await fetchMailBody(account, row.folder, row.message_uid, mailId).then(r => {
        if (r) { bodyText = r.bodyText; bodyHtml = r.bodyHtml; }
      }).catch(err => console.error(`[MailDetail] 从 IMAP 拉取正文失败 (${mailId}):`, err));
    }
  }

  const attachments: Attachment[] = JSON.parse(row.attachments || '[]');
  const toList: string[] = JSON.parse(row.to_list || '[]');
  const ccList: string[] = JSON.parse(row.cc_list || '[]');

  const customRules = loadCustomRules();
  const forwardLogs: ForwardLog[] = db.prepare(
    'SELECT method_type, method_name, forwarded_at FROM mail_forward_log WHERE mail_id = ? ORDER BY id'
  ).all(mailId).map((r: any) => ({
    methodType: r.method_type,
    methodName: r.method_name,
    forwardedAt: r.forwarded_at,
  }));
  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name || '',
    accountEmail: row.account_email || '',
    avatarColor: row.avatar_color || '',
    avatarName: row.avatar_name || '',
    folder: row.folder,
    fromName: row.from_name,
    fromAddress: row.from_address,
    subject: row.subject,
    receivedAt: row.received_at,
    isRead: true,
    isFlagged: row.is_flagged === 1,
    hasAttachments: attachments.length > 0,
    verificationCode: detectVerificationCode(row.subject || '', bodyText, row.from_address || '', customRules),
    toList,
    ccList,
    bodyText,
    bodyHtml,
    attachments,
    forwardLogs,
  };
}

// 测试IMAP连接
export async function testImapConnection(host: string, port: number, secure: boolean, user: string, pass: string): Promise<boolean> {
  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
    return true;
  } catch {
    try { await client.logout(); } catch { /* ignore */ }
    return false;
  }
}

// 搜索邮件（用于验证码规则测试选邮件）
export function searchMails(query: string, limit: number = 20): { id: string; subject: string; fromName: string; fromAddress: string; receivedAt: string }[] {
  const db = getDatabase();
  const like = `%${query}%`;
  const rows = db.prepare(`
    SELECT m.id, m.subject, m.from_name, m.from_address, m.received_at
    FROM mails m
    WHERE m.is_deleted = 0 AND (m.subject LIKE ? OR m.from_address LIKE ?)
    ORDER BY m.received_at DESC
    LIMIT ?
  `).all(like, like, limit) as any[];

  return rows.map(r => ({
    id: r.id,
    subject: r.subject || '',
    fromName: r.from_name || '',
    fromAddress: r.from_address || '',
    receivedAt: r.received_at || r.created_at,
  }));
}
