import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAccounts, sendMail, getMail } from '../services/api';
import { useUI } from '../contexts/UIContext';
import type { MailAccount, SendMailInput, MailDetail } from '../types';

export default function Compose() {
  const { toast } = useUI();
  const { replyToId } = useParams<{ replyToId: string }>();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [replyMail, setReplyMail] = useState<MailDetail | null>(null);

  const [form, setForm] = useState<{
    accountId: string;
    to: string;
    cc: string;
    subject: string;
    body: string;
  }>({
    accountId: '',
    to: '',
    cc: '',
    subject: '',
    body: '',
  });

  useEffect(() => {
    getAccounts().then(list => {
      setAccounts(list);
      if (list.length > 0 && !form.accountId) {
        setForm(prev => ({ ...prev, accountId: list[0].id }));
      }
    }).catch(() => {});
  }, []);

  // 回复模式：加载原邮件
  useEffect(() => {
    if (replyToId) {
      getMail(replyToId).then(mail => {
        setReplyMail(mail);
        setForm(prev => ({
          ...prev,
          to: mail.fromAddress,
          subject: `Re: ${mail.subject}`,
          accountId: mail.accountId || prev.accountId,
          body: `\n\n\n-------- 原始邮件 --------\n发件人: ${mail.fromName} <${mail.fromAddress}>\n收件人: ${mail.toList.join(', ')}\n主题: ${mail.subject}\n时间: ${new Date(mail.receivedAt).toLocaleString('zh-CN')}\n\n${mail.bodyText}`,
        }));
      }).catch(() => {});
    }
  }, [replyToId]);

  const handleSend = async () => {
    if (!form.to.trim()) {
      setError('请填写收件人');
      return;
    }
    if (!form.subject.trim()) {
      setError('请填写主题');
      return;
    }
    if (!form.accountId) {
      setError('请选择发件邮箱');
      return;
    }

    setError('');
    setSending(true);

    try {
      const input: SendMailInput = {
        accountId: form.accountId,
        to: form.to.split(/[,;，；]/).map(s => s.trim()).filter(Boolean),
        cc: form.cc.split(/[,;，；]/).map(s => s.trim()).filter(Boolean),
        subject: form.subject,
        body: form.body,
        isHtml: false,
      };

      await sendMail(input);
      toast('邮件发送成功', 'success');
      navigate('/inbox');
    } catch (err: any) {
      setError(err.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const toInputId = accounts.find(a => a.id === form.accountId);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <div className="px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {replyToId ? '回复邮件' : '写邮件'}
          </h1>
        </div>
        <button
          onClick={handleSend}
          disabled={sending}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {sending ? '发送中...' : '发送'}
        </button>
      </div>

      {/* 表单 */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* 发件账户 */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 w-20 flex-shrink-0">发件人</label>
              <select
                value={form.accountId}
                onChange={e => setForm(prev => ({ ...prev, accountId: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {accounts.length === 0 && <option value="">请先添加邮箱账户</option>}
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.email})</option>
                ))}
              </select>
            </div>

            {/* 收件人 */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 w-20 flex-shrink-0">收件人</label>
              <input
                type="text"
                placeholder="多个收件人用逗号或分号分隔"
                value={form.to}
                onChange={e => setForm(prev => ({ ...prev, to: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 抄送 */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 w-20 flex-shrink-0">抄送</label>
              <input
                type="text"
                placeholder="可选，多个用逗号分隔"
                value={form.cc}
                onChange={e => setForm(prev => ({ ...prev, cc: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 主题 */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 w-20 flex-shrink-0">主题</label>
              <input
                type="text"
                placeholder="邮件主题"
                value={form.subject}
                onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 正文 */}
            <div>
              <textarea
                placeholder="在此撰写邮件内容..."
                value={form.body}
                onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                style={{ minHeight: '300px' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
