// 邮箱提供商预设配置
export const MAIL_PROVIDERS: Record<string, { name: string; imapHost: string; imapPort: number; imapSecure: boolean; smtpHost: string; smtpPort: number; smtpSecure: boolean }> = {
  '163': {
    name: '163邮箱',
    imapHost: 'imap.163.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  'qq': {
    name: 'QQ邮箱',
    imapHost: 'imap.qq.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  'gmail': {
    name: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
  },
  'outlook': {
    name: 'Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
  },
};

// 数据库行 - 邮箱账户
export interface AccountRow {
  id: string;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: number;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: number;
  auth_code: string;
  provider: string;
  created_at: string;
  updated_at: string;
}

// API返回的账户（不含敏感信息）
export interface AccountDTO {
  id: string;
  name: string;
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

// 创建账户输入
export interface CreateAccountInput {
  name: string;
  email: string;
  authCode: string;
  provider?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

// 数据库行 - 邮件
export interface MailRow {
  id: string;
  account_id: string;
  message_uid: number;
  folder: string;
  from_name: string;
  from_address: string;
  to_list: string;
  cc_list: string;
  subject: string;
  body_text: string;
  body_html: string;
  attachments: string;
  received_at: string;
  is_read: number;
  is_flagged: number;
  is_deleted: number;
  created_at: string;
}

// 邮件摘要（列表用）
export interface MailSummary {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  folder: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
}

// 邮件附件
export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
}

// 邮件详情
export interface MailDetail extends MailSummary {
  toList: string[];
  ccList: string[];
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
}

// 发送邮件输入
export interface SendMailInput {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}
