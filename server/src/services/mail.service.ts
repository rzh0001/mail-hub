import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser, type AddressObject } from 'mailparser';
import { v4 as uuid } from 'uuid';
import { getDatabase } from '../database';
import type { AccountRow, MailRow, MailSummary, MailDetail, Attachment, SendMailInput } from '../types';

// 安全地从中提取地址列表，兼容 AddressObject | AddressObject[]
function extractAddresses(addr: AddressObject | AddressObject[] | undefined): Array<{ name?: string; address?: string }> {
  if (!addr) return [];
  if (Array.isArray(addr)) {
    return addr.flatMap(a => (a as AddressObject).value || []);
  }
  return addr.value || [];
}

// 从IMAP同步邮件到本地数据库
export async function syncMails(account: AccountRow, folder: string = 'INBOX', maxCount: number = 50): Promise<number> {
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

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(folder);
    const total = mailbox.exists;

    if (total === 0) return 0;

    const db = getDatabase();

    // 查询已存在的 UID 集合
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

      const mail: MailRow = {
        id: uuid(),
        account_id: account.id,
        message_uid: msg.uid,
        folder,
        from_name: fromAddr?.name || '',
        from_address: fromAddr?.address || '',
        to_list: JSON.stringify(toList),
        cc_list: JSON.stringify(ccList),
        subject: parsed.subject || '',
        body_text: parsed.text || '',
        body_html: parsed.html || '',
        attachments: JSON.stringify(attachments),
        received_at: receivedAt,
        is_read: msg.flags?.has('\\Seen') ? 1 : 0,
        is_flagged: msg.flags?.has('\\Flagged') ? 1 : 0,
        is_deleted: 0,
        created_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO mails (id, account_id, message_uid, folder, from_name, from_address, to_list, cc_list,
          subject, body_text, body_html, attachments, received_at, is_read, is_flagged, is_deleted, created_at)
        VALUES (@id, @account_id, @message_uid, @folder, @from_name, @from_address, @to_list, @cc_list,
          @subject, @body_text, @body_html, @attachments, @received_at, @is_read, @is_flagged, @is_deleted, @created_at)
      `).run(mail);

      synced++;
    }

    await client.logout();
    return synced;
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

// 批量删除
export function batchMarkDeleted(mailIds: string[]): void {
  if (mailIds.length === 0) return;
  const db = getDatabase();
  const placeholders = mailIds.map(() => '?').join(',');
  db.prepare(`UPDATE mails SET is_deleted = 1 WHERE id IN (${placeholders})`).run(...mailIds);
}

// 标记星标
export function markFlagged(mailId: string, isFlagged: boolean): void {
  const db = getDatabase();
  db.prepare('UPDATE mails SET is_flagged = ? WHERE id = ?').run(isFlagged ? 1 : 0, mailId);
}

// 标记删除
export function markDeleted(mailId: string): void {
  const db = getDatabase();
  db.prepare('UPDATE mails SET is_deleted = 1 WHERE id = ?').run(mailId);
}

// 获取邮件列表
export function getMailList(accountId?: string, folder?: string, page: number = 1, pageSize: number = 20): { mails: MailSummary[], total: number } {
  const db = getDatabase();

  let where = 'WHERE m.is_deleted = 0';
  const params: any[] = [];

  if (accountId) {
    where += ' AND m.account_id = ?';
    params.push(accountId);
  }
  if (folder) {
    where += ' AND m.folder = ?';
    params.push(folder);
  }

  // 取总数
  const countRow = db.prepare(`SELECT COUNT(*) as cnt FROM mails m ${where}`).get(...params) as any;
  const total = countRow.cnt;

  // 分页
  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);

  const rows = db.prepare(`
    SELECT m.*, a.name as account_name, a.email as account_email
    FROM mails m
    LEFT JOIN accounts a ON m.account_id = a.id
    ${where}
    ORDER BY m.received_at DESC
    LIMIT ? OFFSET ?
  `).all(...params) as any[];

  const mails: MailSummary[] = rows.map(r => ({
    id: r.id,
    accountId: r.account_id,
    accountName: r.account_name || '',
    accountEmail: r.account_email || '',
    folder: r.folder,
    fromName: r.from_name,
    fromAddress: r.from_address,
    subject: r.subject,
    receivedAt: r.received_at,
    isRead: r.is_read === 1,
    isFlagged: r.is_flagged === 1,
    hasAttachments: JSON.parse(r.attachments || '[]').length > 0,
  }));

  return { mails, total };
}

// 获取邮件详情
export function getMailDetail(mailId: string): MailDetail | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT m.*, a.name as account_name, a.email as account_email
    FROM mails m
    LEFT JOIN accounts a ON m.account_id = a.id
    WHERE m.id = ?
  `).get(mailId) as any;

  if (!row) return null;

  // 自动标记为已读
  if (!row.is_read) {
    db.prepare('UPDATE mails SET is_read = 1 WHERE id = ?').run(mailId);
  }

  const attachments: Attachment[] = JSON.parse(row.attachments || '[]');
  const toList: string[] = JSON.parse(row.to_list || '[]');
  const ccList: string[] = JSON.parse(row.cc_list || '[]');

  return {
    id: row.id,
    accountId: row.account_id,
    accountName: row.account_name || '',
    accountEmail: row.account_email || '',
    folder: row.folder,
    fromName: row.from_name,
    fromAddress: row.from_address,
    subject: row.subject,
    receivedAt: row.received_at,
    isRead: true,
    isFlagged: row.is_flagged === 1,
    hasAttachments: attachments.length > 0,
    toList,
    ccList,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    attachments,
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
