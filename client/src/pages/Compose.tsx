import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { getAccounts, sendMail, getMail } from '../services/api';
import { useUI } from '../contexts/UIContext';
import type { MailAccount, SendMailInput, MailDetail } from '../types';

const DRAFT_KEY = 'mailhub_compose_draft';

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['link'],
    ['clean'],
  ],
};

const QUILL_FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'blockquote', 'code-block',
  'list', 'bullet',
  'color', 'background',
  'link',
];

function formatOriginalMailAsHtml(mail: MailDetail): string {
  const from = mail.fromName ? `${mail.fromName} &lt;${mail.fromAddress}&gt;` : mail.fromAddress;
  const to = mail.toList.join(', ') || '(无)';
  const date = new Date(mail.receivedAt).toLocaleString('zh-CN');
  const quoted = (mail.bodyText || '')
    .split('\n')
    .map(line => `&gt; ${line}`)
    .join('<br>');
  return `
    <br><br>
    <div style="color:#666;font-size:13px;border-left:2px solid #ddd;padding-left:10px;margin:10px 0;">
      <div><b>原始邮件</b></div>
      <div>发件人: ${from}</div>
      <div>收件人: ${to}</div>
      <div>主题: ${mail.subject}</div>
      <div>时间: ${date}</div>
    </div>
    <blockquote style="margin:0;padding-left:10px;border-left:2px solid #ddd;color:#555;font-size:13px;">
      ${quoted}
    </blockquote>
  `;
}

export default function Compose() {
  const { toast } = useUI();
  const { replyToId } = useParams<{ replyToId: string }>();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');
  const [replyMail, setReplyMail] = useState<MailDetail | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>();
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

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

  // 加载账户
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
          body: formatOriginalMailAsHtml(mail),
        }));
      }).catch(() => {});
    }
  }, [replyToId]);

  // 加载本地草稿（非回复模式下）
  useEffect(() => {
    if (replyToId) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        setForm(prev => ({
          ...prev,
          accountId: draft.accountId || prev.accountId,
          to: draft.to || '',
          cc: draft.cc || '',
          subject: draft.subject || '',
          body: draft.body || '',
        }));
        setLastSavedAt(draft.savedAt ? new Date(draft.savedAt).toLocaleString('zh-CN') : null);
      }
    } catch { /* ignore */ }
  }, [replyToId]);

  // 自动保存草稿
  const saveDraft = useCallback((data: typeof form, silent = true) => {
    if (replyToId) return; // 回复模式不自动保存为草稿
    try {
      const payload = { ...data, savedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      if (!silent) toast('草稿已保存', 'success');
      setLastSavedAt(new Date().toLocaleString('zh-CN'));
    } catch {
      if (!silent) toast('草稿保存失败', 'error');
    }
  }, [replyToId, toast]);

  useEffect(() => {
    if (replyToId) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft(form, true);
    }, 3000);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [form, replyToId, saveDraft]);

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setLastSavedAt(null);
  };

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
        isHtml: true,
      };

      await sendMail(input);
      clearDraft();
      toast('邮件发送成功', 'success');
      navigate('/inbox');
    } catch (err: any) {
      setError(err.message || '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleManualSaveDraft = async () => {
    setSavingDraft(true);
    saveDraft(form, false);
    setSavingDraft(false);
  };

  const handleDiscard = () => {
    if (window.confirm('确定要放弃这封邮件吗？未保存的草稿将丢失。')) {
      clearDraft();
      navigate('/inbox');
    }
  };

  const toInputId = accounts.find(a => a.id === form.accountId);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 顶部栏 */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
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
          {lastSavedAt && (
            <span className="hidden sm:inline text-xs text-gray-400">
              草稿已保存 {lastSavedAt}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSaveDraft}
            disabled={savingDraft || !!replyToId}
            className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {savingDraft ? '保存中...' : '保存草稿'}
          </button>
          <button
            onClick={handleDiscard}
            className="px-3 py-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            丢弃
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>

      {/* 表单 */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* 发件账户 */}
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">发件人</label>
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
              <label className="text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">收件人</label>
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
              <label className="text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">抄送</label>
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
              <label className="text-sm text-gray-500 w-16 sm:w-20 flex-shrink-0">主题</label>
              <input
                type="text"
                placeholder="邮件主题"
                value={form.subject}
                onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* 正文编辑器 */}
            <div>
              <label className="text-sm text-gray-500 mb-1.5 block">正文</label>
              <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                <ReactQuill
                  theme="snow"
                  value={form.body}
                  onChange={value => setForm(prev => ({ ...prev, body: value }))}
                  modules={QUILL_MODULES}
                  formats={QUILL_FORMATS}
                  placeholder="在此撰写邮件内容..."
                  className="compose-editor"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .compose-editor .ql-editor {
          min-height: 320px;
          font-size: 14px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
