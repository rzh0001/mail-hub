// 邮箱提供商预设配置
export const MAIL_PROVIDERS: Record<string, { name: string; imapHost: string; imapPort: number; imapSecure: boolean; smtpHost: string; smtpPort: number; smtpSecure: boolean; sentFolder: string; trashFolder: string }> = {
  '163': {
    name: '163邮箱',
    imapHost: 'imap.163.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.163.com',
    smtpPort: 465,
    smtpSecure: true,
    sentFolder: '已发送',
    trashFolder: '已删除',
  },
  'qq': {
    name: 'QQ邮箱',
    imapHost: 'imap.qq.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
    smtpSecure: true,
    sentFolder: '已发送',
    trashFolder: '已删除',
  },
  'gmail': {
    name: 'Gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    smtpSecure: true,
    sentFolder: '[Gmail]/已发送邮件',
    trashFolder: '[Gmail]/已删除邮件',
  },
  'outlook': {
    name: 'Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    sentFolder: 'Sent Items',
    trashFolder: 'Deleted Items',
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
  avatar_color: string;
  avatar_name: string;
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
  avatarColor: string;
  avatarName: string;
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
  avatarColor?: string;
  avatarName?: string;
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
  avatarColor: string;
  avatarName: string;
  folder: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  receivedAt: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  verificationCode: string;
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

// 更新账户输入
export interface UpdateAccountInput {
  name?: string;
  avatarColor?: string;
  avatarName?: string;
}

// 系统设置（键值对）
export type SettingsMap = Record<string, string>;

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

// 转发规则（数据库行）
export interface ForwardingRuleRow {
  id: number;
  type: 'subject_keyword' | 'sender_pattern';
  value: string;
  target_email: string;
  method_id: number | null;
  enabled: number;
  created_at: string;
}

// 转发方式（数据库行）
export interface ForwardingMethodRow {
  id: number;
  type: 'email' | 'serverchan' | 'wecom_bot' | 'feishu_bot';
  name: string;
  target: string;
  enabled: number;
  is_default: number;
  created_at: string;
}

// 垃圾箱规则（数据库行）
export interface TrashRuleRow {
  id: number;
  type: 'subject_keyword' | 'sender_pattern';
  value: string;
  enabled: number;
  created_at: string;
}

// 邮箱提供商文件夹配置
export interface ProviderFolderConfig {
  sentFolder: string;
  trashFolder: string;
}
