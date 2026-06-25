import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getMails, getMail, markRead, markFlagged, deleteMail, batchMarkRead, batchDeleteMails } from '../services/api';
import { useUI } from '../contexts/UIContext';
import type { MailSummary, MailDetail as MailDetailType } from '../types';

export default function Inbox() {
  const { confirm, toast } = useUI();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accountId = searchParams.get('accountId') || undefined;
  const selectedId = searchParams.get('selected') || undefined;

  // 列表状态
  const [mails, setMails] = useState<MailSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  // 批量选择
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // 详情状态
  const [detail, setDetail] = useState<MailDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  // 移动端：列表/详情切换
  const [showDetailMobile, setShowDetailMobile] = useState(false);

  // 加载邮件列表
  const loadMails = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMails({ accountId, page, pageSize });
      setMails(result.mails);
      setTotal(result.total);
    } catch (err) {
      console.error('加载邮件列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [accountId, page]);

  useEffect(() => { loadMails(); }, [loadMails]);
  useEffect(() => { setPage(1); }, [accountId]);

  // 加载邮件详情
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setShowRaw(false);
    getMail(selectedId)
      .then(m => {
        setDetail(m);
        // 无论服务端返回什么，用户点击了就该标记已读
        setMails(prev => prev.map(mail =>
          mail.id === selectedId ? { ...mail, isRead: true } : mail
        ));
        markRead(selectedId, true).catch(() => {});
        // 滚动到顶部
        detailRef.current?.scrollTo(0, 0);
      })
      .catch(() => { toast('加载邮件失败', 'error'); setDetail(null); })
      .finally(() => setDetailLoading(false));
  }, [selectedId, toast]);

  // 选中邮件
  const handleSelect = (id: string) => {
    setSearchParams(prev => {
      prev.set('selected', id);
      return prev;
    });
    setShowDetailMobile(true);
  };

  // 返回列表（移动端）
  const handleBack = () => {
    setShowDetailMobile(false);
    setSearchParams(prev => {
      prev.delete('selected');
      return prev;
    });
  };

  // 星标
  const handleFlag = async () => {
    if (!detail || !selectedId) return;
    try {
      await markFlagged(selectedId, !detail.isFlagged);
      setDetail(prev => prev ? { ...prev, isFlagged: !prev.isFlagged } : null);
      setMails(prev => prev.map(m => m.id === selectedId ? { ...m, isFlagged: !detail.isFlagged } : m));
    } catch { toast('操作失败', 'error'); }
  };

  // 删除
  const handleDelete = async () => {
    if (!selectedId) return;
    const ok = await confirm('确定要删除这封邮件吗？');
    if (!ok) return;
    try {
      await deleteMail(selectedId);
      setDetail(null);
      setSearchParams(prev => { prev.delete('selected'); return prev; });
      setShowDetailMobile(false);
      loadMails();
      toast('邮件已删除', 'success');
    } catch { toast('删除失败', 'error'); }
  };

  // 回复
  const handleReply = () => {
    if (selectedId) navigate(`/compose/${selectedId}`);
  };

  // ----- 批量操作 -----
  const allSelected = mails.length > 0 && mails.every(m => selectedIds.has(m.id));
  const someSelected = selectedIds.size > 0;

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mails.map(m => m.id)));
    }
  };

  const handleBatchRead = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      await batchMarkRead(ids);
      setMails(prev => prev.map(m => ids.includes(m.id) ? { ...m, isRead: true } : m));
      setSelectedIds(new Set());
      toast(`已标记 ${ids.length} 封邮件为已读`, 'success');
    } catch { toast('批量操作失败', 'error'); }
    finally { setBatchLoading(false); }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirm(`确定要删除选中的 ${ids.length} 封邮件吗？`);
    if (!ok) return;
    setBatchLoading(true);
    try {
      await batchDeleteMails(ids);
      setMails(prev => prev.filter(m => !ids.includes(m.id)));
      // 如果当前查看的邮件被删了，关闭详情
      if (selectedId && ids.includes(selectedId)) {
        setDetail(null);
        setSearchParams(prev => { prev.delete('selected'); return prev; });
      }
      setSelectedIds(new Set());
      toast(`已删除 ${ids.length} 封邮件`, 'success');
    } catch { toast('批量删除失败', 'error'); }
    finally { setBatchLoading(false); }
  };

  // 切换页面或过滤条件时清空选中
  useEffect(() => { setSelectedIds(new Set()); }, [accountId, page]);

  const totalPages = Math.ceil(total / pageSize);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatDateFull = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ------------- 渲染 -------------
  return (
    <div className="h-full flex">
      {/* ===== 左侧：邮件列表 ===== */}
      <div className={`w-full lg:w-[400px] xl:w-[460px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col ${
        showDetailMobile ? 'hidden lg:flex' : 'flex'
      }`}>
        {/* 列表头部 */}
        <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-3">
          {mails.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
              <input type="checkbox" checked={allSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
              <span className="text-xs select-none">全选</span>
            </label>
          )}
          <p className="text-sm text-gray-500">
            {total > 0 ? `共 ${total} 封` : '暂无邮件'}
          </p>
        </div>

        {/* 批量操作栏 */}
        {someSelected && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <span className="text-sm text-blue-700 font-medium">已选 {selectedIds.size} 封</span>
            <button onClick={handleBatchRead} disabled={batchLoading}
              className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
              标记已读
            </button>
            <button onClick={handleBatchDelete} disabled={batchLoading}
              className="px-2.5 py-1 text-xs bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50">
              删除
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-gray-400 hover:text-gray-600">
              取消
            </button>
          </div>
        )}

        {/* 邮件列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : mails.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-sm">暂无邮件</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {mails.map(mail => {
                const isChecked = selectedIds.has(mail.id);
                return (
                  <div key={mail.id}
                    className={`flex items-stretch border-l-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedId === mail.id ? 'border-l-blue-500 bg-blue-50/40' : 'border-l-transparent'
                    } ${!mail.isRead ? 'bg-blue-50/20' : ''}`}
                  >
                    {/* 复选框 */}
                    <label className="flex items-center pl-3 pr-1 cursor-pointer"
                      onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isChecked}
                        onChange={() => handleToggleSelect(mail.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    </label>
                    {/* 邮件内容（点击打开详情） */}
                    <button onClick={() => handleSelect(mail.id)}
                      className="flex-1 text-left py-3.5 pr-4 min-w-0">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0 mt-0.5">
                          {mail.accountEmail.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm truncate ${!mail.isRead ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                              {mail.fromName || mail.fromAddress}
                            </span>
                            {!mail.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                            <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{formatDate(mail.receivedAt)}</span>
                          </div>
                          <p className={`text-sm truncate mb-0.5 ${!mail.isRead ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                            {mail.subject || '(无主题)'}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 truncate">{mail.accountEmail}</span>
                            {mail.hasAttachments && (
                              <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                            )}
                            {mail.isFlagged && (
                              <svg className="w-3 h-3 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M7 2v16h2v-6h6.5L12 8l3.5-4H9V2H7z" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>第 {page}/{totalPages} 页</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-2.5 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">上一页</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-2.5 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40">下一页</button>
            </div>
          </div>
        )}
      </div>

      {/* ===== 右侧：邮件详情 ===== */}
      <div className={`flex-1 min-w-0 bg-white flex flex-col ${
        !showDetailMobile ? 'hidden lg:flex' : 'flex'
      }`}>
        {!selectedId || !detail ? (
          /* 未选中邮件：空白占位 */
          <div className="flex-1 flex items-center justify-center text-gray-300">
            {detailLoading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            ) : (
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">选择一封邮件查看详情</p>
              </div>
            )}
          </div>
        ) : detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          /* 邮件详情 */
          <div className="h-full flex flex-col">
            {/* 详情顶部操作栏 */}
            <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2">
              {/* 移动端返回按钮 */}
              <button onClick={handleBack} className="lg:hidden p-1 hover:bg-gray-100 rounded-lg mr-1">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <span className="text-xs text-gray-400 mr-auto">邮件详情</span>

              {/* 回复 */}
              <button onClick={handleReply}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                回复
              </button>

              {/* 星标 */}
              <button onClick={handleFlag}
                className={`p-1.5 rounded-lg transition-colors ${detail.isFlagged ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}
                title={detail.isFlagged ? '取消星标' : '标记星标'}>
                <svg className="w-4 h-4" fill={detail.isFlagged ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>

              {/* 删除 */}
              <button onClick={handleDelete} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors" title="删除">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {/* 详情内容 */}
            <div ref={detailRef} className="flex-1 overflow-y-auto">
              <div className="max-w-3xl px-6 py-5">
                {/* 头部信息 */}
                <h1 className="text-xl font-semibold text-gray-900 mb-4">{detail.subject || '(无主题)'}</h1>

                <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-16 flex-shrink-0">发件人</span>
                    <span className="font-medium text-gray-800">
                      {detail.fromName ? `${detail.fromName} <${detail.fromAddress}>` : detail.fromAddress}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 w-16 flex-shrink-0">收件人</span>
                    <span className="text-gray-700">{detail.toList.join(', ') || '未指定'}</span>
                  </div>
                  {detail.ccList.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-400 w-16 flex-shrink-0">抄送</span>
                      <span className="text-gray-700">{detail.ccList.join(', ')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-16 flex-shrink-0">时间</span>
                    <span className="text-gray-700">{formatDateFull(detail.receivedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 w-16 flex-shrink-0">账户</span>
                    <span className="text-gray-700">{detail.accountName} ({detail.accountEmail})</span>
                  </div>
                </div>

                {/* 附件 */}
                {detail.attachments.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">附件 ({detail.attachments.length})</h3>
                    <div className="flex flex-wrap gap-2">
                      {detail.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="text-sm text-gray-600">{att.filename}</span>
                          <span className="text-xs text-gray-400">({formatSize(att.size)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 正文切换 */}
                {detail.bodyHtml && (
                  <div className="mb-3">
                    <button onClick={() => setShowRaw(!showRaw)} className="text-sm text-blue-600 hover:text-blue-700">
                      {showRaw ? '查看 HTML 格式' : '查看纯文本'}
                    </button>
                  </div>
                )}

                {/* 邮件正文 */}
                <div className="border-t border-gray-100 pt-5">
                  {detail.bodyHtml && !showRaw ? (
                    <div className="mail-body text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: detail.bodyHtml }} />
                  ) : (
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {detail.bodyText || '(无内容)'}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
