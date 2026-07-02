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
  sentFolder: string;
  trashFolder: string;
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
  avatarColor: string;
  avatarName: string;
  createdAt: string;
  updatedAt: string;
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

// 附件
export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
}

// 转发日志
export interface ForwardLog {
  methodType: string;
  methodName: string;
  forwardedAt: string;
}

// 邮件详情
export interface MailDetail extends MailSummary {
  toList: string[];
  ccList: string[];
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
  forwardLogs: ForwardLog[];
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
  avatarColor?: string;
  avatarName?: string;
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
  avatarColor: string;
  avatarName: string;
}

// 更新账户输入
export interface UpdateAccountInput {
  name?: string;
  avatarColor?: string;
  avatarName?: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

// 系统设置
export type SettingsMap = Record<string, string>;

// 验证码识别规则
export interface VerificationRule {
  id: number;
  type: 'subject_keyword' | 'sender_pattern';
  value: string;
  enabled: number;
  created_at: string;
}

// 内置验证码规则（不可编辑，可关闭）
export interface BuiltinVerificationRule {
  id: string;
  type: 'subject_keyword' | 'sender_pattern' | 'extract_pattern';
  value: string;
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

// 转发规则
export interface ForwardingRule {
  id: number;
  type: 'subject_keyword' | 'sender_pattern' | 'verification_code';
  value: string;
  target_email: string;
  method_id: number | null;
  enabled: number;
  created_at: string;
}

// 转发方式
export interface ForwardingMethod {
  id: number;
  type: 'email' | 'serverchan' | 'wecom_bot' | 'feishu_bot';
  name: string;
  target: string;
  enabled: number;
  is_default: number;
  created_at: string;
}

// 垃圾箱规则
export interface TrashRule {
  id: number;
  type: 'subject_keyword' | 'sender_pattern';
  value: string;
  enabled: number;
  created_at: string;
}
