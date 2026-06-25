// API 响应包装
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 邮箱提供商
export interface MailProvider {
  id: string;
  name: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

// 邮箱账户
export interface MailAccount {
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

// 附件
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

// 邮件列表响应
export interface MailListResponse {
  mails: MailSummary[];
  total: number;
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

// 账户完整配置（含授权码）
export interface AccountConfig {
  name: string;
  email: string;
  authCode: string;
  provider: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

// 导入结果
export interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
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
